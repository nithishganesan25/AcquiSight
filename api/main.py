"""
ACQUISIGHT FastAPI — delay prediction, case persistence, explainable AI,
grounded copilot, live analytics, and safe ML retraining on official land records.
"""

from __future__ import annotations

import io
import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Internal Modular Architecture
sys.path.insert(0, str(Path(__file__).resolve().parent))
from auth import OfficerUser, get_current_user
from chat_service import handle_chat_query
from explainability import generate_risk_explanation
from repository import cases_repo
from retrain_service import execute_safe_retrain, get_retrain_status

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(open(sys.stdout.fileno(), mode="w", encoding="utf-8", closefd=False))
    ],
)
log = logging.getLogger("acquisight.api")

_API_DIR = Path(__file__).resolve().parent
_ROOT = _API_DIR.parent
_MODELS = _ROOT / "models"
_DATA_DIR = _ROOT / "data"

PIPELINE_PATH = _MODELS / "delay_regression_pipeline.pkl"
CLASSIFIER_PATH = _MODELS / "risk_classification_pipeline.pkl"
LEGACY_PIPELINE = _MODELS / "acquisight_pipeline.pkl"
METADATA_PATH = _MODELS / "model_metadata.json"
CONFIG_PATH = _MODELS / "config.json"
IMPORTANCE_PATH = _MODELS / "feature_importance.csv"
SCORED_CSV = _DATA_DIR / "land_records_scored.csv"
CLEANED_CSV = _DATA_DIR / "cleaned_land_records.csv"
CATEGORIES_JSON = _DATA_DIR / "feature_categories.json"
_GIS_PARCELS_CSV = _DATA_DIR / "gis_parcels.csv"
_TN_CASES_JSON = _DATA_DIR / "tn_cases_processed.json"

app = FastAPI(
    title="ACQUISIGHT — Land Acquisition Intelligence Platform API",
    description="Operational persistence, explainable delay risk prediction, and grounded AI assistant for Tamil Nadu land administration.",
    version="3.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_reg_pipeline = None
_clf_pipeline = None
_config: Dict[str, Any] = {}
_load_error: Optional[str] = None


def _load_artifacts() -> None:
    global _reg_pipeline, _clf_pipeline, _config, _load_error
    try:
        reg_path = PIPELINE_PATH if PIPELINE_PATH.exists() else LEGACY_PIPELINE
        if reg_path.exists():
            _reg_pipeline = joblib.load(reg_path)
            log.info("Regression pipeline loaded from %s", reg_path)
        if CLASSIFIER_PATH.exists():
            _clf_pipeline = joblib.load(CLASSIFIER_PATH)
            log.info("Classifier pipeline loaded from %s", CLASSIFIER_PATH)
        if CONFIG_PATH.exists():
            with open(CONFIG_PATH, encoding="utf-8") as fh:
                _config = json.load(fh)
        _load_error = None
    except Exception as exc:
        _load_error = str(exc)
        log.exception("Failed to load model artifacts")


_load_artifacts()


class LandRequest(BaseModel):
    land_id: Optional[str] = None
    district: Optional[str] = Field(default="Kancheepuram")
    taluk: Optional[str] = None
    village: Optional[str] = None
    survey_no: Optional[str] = None
    area_sqft: float = Field(..., gt=0)
    soil_ph: float = Field(..., ge=0, le=14)
    no_of_owners: int = Field(..., ge=1)
    land_type: str
    flood_risk: str
    water_availability: str
    soil_type: str
    document_issue: str
    owner_objection: str
    court_case: str
    compensation_status: str
    fmb: str = "Yes"
    a_register: str = "Yes"
    document_verified: str = "Yes"
    objection: str = "No"
    ownership_type: str = "Individual"


class RiskFactor(BaseModel):
    factor: str
    impact: str
    description: str


class PredictionResponse(BaseModel):
    land_id: Optional[str]
    predicted_delay_days: float
    predicted_delay_range: Dict[str, float]
    delay_status: str
    delay_status_probability: Optional[float] = None
    risk_category: str
    risk_score: int
    risk_factors: List[RiskFactor]
    recommendation: str
    label_notes: Dict[str, str]


def _require_model() -> None:
    if _reg_pipeline is None:
        raise HTTPException(
            status_code=503,
            detail=f"Model not loaded. Run: python src/Train_model.py. {_load_error or ''}".strip(),
        )


def _days_to_risk(days: float) -> str:
    thresholds = _config.get(
        "risk_thresholds",
        {"Low": {"max": 60}, "Medium": {"max": 120}, "High": {"max": 9999}},
    )
    if days <= thresholds["Low"]["max"]:
        return "Low"
    if days <= thresholds["Medium"]["max"]:
        return "Medium"
    return "High"


def _build_feature_frame(req: LandRequest) -> pd.DataFrame:
    row = {
        "Area_Sqft": req.area_sqft,
        "Soil_pH": req.soil_ph,
        "No_of_Owners": req.no_of_owners,
        "District": (req.district or "Unknown").strip(),
        "Land_Type": req.land_type.strip().title(),
        "Flood_Risk": req.flood_risk.strip().title(),
        "Water_Availability": req.water_availability.strip().title(),
        "Soil_Type": req.soil_type.strip(),
        "Document_Issue": req.document_issue.strip().title() if req.document_issue.lower() != "not available" else "Not Available",
        "Owner_Objection": req.owner_objection.strip().title(),
        "Court_Case": req.court_case.strip().title(),
        "Compensation_Status": req.compensation_status.strip(),
        "FMB": req.fmb.strip().title(),
        "A_Register": req.a_register.strip().title(),
        "Document_Verified": req.document_verified.strip().title(),
        "Objection": req.objection.strip().title(),
        "Ownership_Type": req.ownership_type.strip().title(),
    }
    if row["Document_Issue"].lower() in {"not available", "notavailable"}:
        row["Document_Issue"] = "Not Available"
    return pd.DataFrame([row])


def _predict_with_interval(X: pd.DataFrame, pipeline, coverage: float = 0.90):
    point = float(np.clip(pipeline.predict(X)[0], 0, None))
    model = pipeline.named_steps.get("model") if hasattr(pipeline, "named_steps") else None
    if model is not None and hasattr(model, "estimators_"):
        preprocessed = pipeline.named_steps["preprocessor"].transform(X)
        tree_preds = np.array([np.clip(tree.predict(preprocessed)[0], 0, None) for tree in model.estimators_])
        alpha = (1 - coverage) / 2
        lower = float(np.quantile(tree_preds, alpha))
        upper = float(np.quantile(tree_preds, 1 - alpha))
    else:
        lower = max(0.0, point * 0.80)
        upper = point * 1.20
    return round(point, 1), round(lower, 1), round(upper, 1)


def _get_risk_factors(req: LandRequest, risk_category: str) -> List[RiskFactor]:
    factors: List[RiskFactor] = []
    rules = [
        (req.court_case.strip().lower() == "yes", "Court Case", "High", "Recorded court involvement is associated with longer acquisition timelines."),
        (req.owner_objection.strip().lower() == "yes", "Owner Objection", "High", "Owner objections typically require enquiry under the acquisition process."),
        (req.objection.strip().lower() == "yes", "Documented Objection", "Medium", "An objection flag is present on the land record."),
        (req.document_issue.strip().lower().startswith("not"), "Documents Not Available", "High", "Missing acquisition documents block progress."),
        (req.document_verified.strip().lower() == "no", "Documents Unverified", "Medium", "Document verification is incomplete."),
        (req.compensation_status.lower().find("court") >= 0 or req.compensation_status.lower().find("withheld") >= 0,
         "Compensation Withheld", "High", "Compensation is withheld pending court or enquiry."),
        (req.compensation_status.lower().find("pending") >= 0 or req.compensation_status.lower().find("enquiry") >= 0,
         "Compensation Enquiry Pending", "Medium", "Compensation processing is still in enquiry/verification."),
        (req.flood_risk.strip().lower() == "yes", "Flood Risk", "Low", "Flood-prone land can add survey and clearance time."),
        (req.no_of_owners > 2, "Multiple Owners", "Low", f"{req.no_of_owners} interested persons require coordination."),
    ]
    for cond, factor, impact, desc in rules:
        if cond:
            factors.append(RiskFactor(factor=factor, impact=impact, description=desc))
    if not factors:
        factors.append(
            RiskFactor(
                factor="Standard Processing",
                impact="Low",
                description="No high-impact legal or documentation flags in the submitted record.",
            )
        )
    return factors[:5]


def _get_recommendation(risk_category: str, delay_status: str, factors: List[RiskFactor]) -> str:
    high = [f.factor for f in factors if f.impact == "High"]
    if delay_status == "Delayed" or risk_category == "High":
        actions = high[:3] or [f.factor for f in factors[:2]]
        return (
            f"Elevated delay likelihood. Priority actions: {', '.join(actions)}. "
            "Treat this as an empirical model estimate, requiring administrative verification."
        )
    if risk_category == "Medium":
        return "Moderate predicted duration. Monitor documentation, objections, and compensation enquiry."
    return "Predicted duration is in the lower band seen in the gazette sample. Continue standard processing."


def _run_prediction(req: LandRequest) -> PredictionResponse:
    _require_model()
    X = _build_feature_frame(req)
    point, lower, upper = _predict_with_interval(X, _reg_pipeline)
    risk_category = _days_to_risk(point)
    risk_score = int(np.clip((point / 180) * 100, 0, 100))

    delay_status = _days_to_risk(point)
    delay_prob = None
    if _clf_pipeline is not None:
        pred = _clf_pipeline.predict(X)[0]
        delay_status = str(pred)
        if hasattr(_clf_pipeline, "predict_proba"):
            proba = _clf_pipeline.predict_proba(X)[0]
            model = _clf_pipeline.named_steps.get("model", _clf_pipeline)
            classes = list(getattr(model, "classes_", []))
            if "Delayed" in classes:
                delay_prob = float(proba[classes.index("Delayed")])
            else:
                delay_prob = float(np.max(proba))

    factors = _get_risk_factors(req, risk_category)
    return PredictionResponse(
        land_id=req.land_id,
        predicted_delay_days=point,
        predicted_delay_range={"lower": lower, "upper": upper},
        delay_status=delay_status,
        delay_status_probability=None if delay_prob is None else round(delay_prob, 4),
        risk_category=risk_category,
        risk_score=risk_score,
        risk_factors=factors,
        recommendation=_get_recommendation(risk_category, delay_status, factors),
        label_notes={
            "predicted_delay_days": "Model prediction of recorded Acquisition_Days.",
            "delay_status": "Model prediction of recorded Delay_Status (No Delay / Delayed).",
            "risk_category": "Derived from predicted days (Low<=60, Medium<=120, High>120).",
        },
    )


# ---------------------------------------------------------------------------
# Health & Model Artifact Endpoints
# ---------------------------------------------------------------------------

@app.get("/", tags=["Health"])
def root() -> Dict[str, str]:
    return {"status": "online", "service": "ACQUISIGHT Land Acquisition Intelligence API", "version": "3.1.0"}


@app.get("/health", tags=["Health"])
def health() -> Dict[str, Any]:
    return {
        "status": "healthy" if _reg_pipeline is not None else "degraded",
        "regression_loaded": _reg_pipeline is not None,
        "classifier_loaded": _clf_pipeline is not None,
        "total_cases_in_db": cases_repo.count(),
        "error": _load_error,
    }


@app.post("/predict", response_model=PredictionResponse, tags=["Prediction"])
def predict_single(land: LandRequest) -> PredictionResponse:
    try:
        return _run_prediction(land)
    except HTTPException:
        raise
    except Exception as exc:
        log.exception("Prediction failed")
        raise HTTPException(status_code=500, detail=f"Prediction error: {exc}") from exc


@app.post("/predict-batch", tags=["Prediction"])
def predict_batch(lands: List[LandRequest]) -> Dict[str, Any]:
    results = []
    errors = []
    for i, land in enumerate(lands):
        try:
            results.append(_run_prediction(land).model_dump())
        except Exception as exc:
            errors.append(f"Item {i}: {exc}")
    return {"total": len(results), "predictions": results, "errors": errors}


@app.get("/model-info", tags=["Explainability"])
def model_info() -> Dict[str, Any]:
    if not METADATA_PATH.exists():
        raise HTTPException(status_code=404, detail="model_metadata.json not found — run src/Train_model.py")
    with open(METADATA_PATH, encoding="utf-8") as fh:
        return json.load(fh)


@app.get("/feature-schema", tags=["Explainability"])
def feature_schema() -> Dict[str, Any]:
    if CATEGORIES_JSON.exists():
        with open(CATEGORIES_JSON, encoding="utf-8") as fh:
            return json.load(fh)
    return {
        "numerical_features": _config.get("numerical_cols", []),
        "categorical_features": _config.get("categorical_cols", []),
        "categories": {},
    }


@app.get("/feature-importance", tags=["Explainability"])
def feature_importance() -> Dict[str, Any]:
    if IMPORTANCE_PATH.exists():
        df = pd.read_csv(IMPORTANCE_PATH)
        if "feature" in df.columns and "importance" in df.columns:
            return {"features": df.to_dict("records"), "source": "trained_model"}
    model = None
    if _reg_pipeline is not None and hasattr(_reg_pipeline, "named_steps"):
        model = _reg_pipeline.named_steps.get("model")
    if model is not None and hasattr(model, "feature_importances_"):
        names = _config.get("feature_columns") or []
        values = list(model.feature_importances_)
        n = min(len(names), len(values))
        rows = [{"feature": names[i], "importance": float(values[i])} for i in range(n)]
        rows.sort(key=lambda r: r["importance"], reverse=True)
        return {"features": rows, "source": "model.feature_importances_"}
    raise HTTPException(
        status_code=404,
        detail="Feature importance is unavailable for the current model.",
    )


# ---------------------------------------------------------------------------
# Cases CRUD & Operational Persistence (FastAPI is Source of Truth)
# ---------------------------------------------------------------------------

class CaseCreatePayload(BaseModel):
    name: Optional[str] = None
    project_name: Optional[str] = None
    district: Optional[str] = "Tiruchirappalli"
    total_area_ha: Optional[float] = 10.0
    area: Optional[str] = None
    owner: Optional[str] = "Tamil Nadu Highways"
    implementing_agency: Optional[str] = None
    landowners: Optional[Any] = 12
    no_of_families_affected: Optional[int] = None
    acquisition_purpose: Optional[str] = "Infrastructure Project"
    land_type: Optional[str] = "Dry"
    soil_type: Optional[str] = "Red Soil"
    flood_risk: Optional[str] = "No"
    water_availability: Optional[str] = "Yes"
    document_issue: Optional[str] = "Available"
    owner_objection: Optional[str] = "No"
    court_case: Optional[str] = "No"
    compensation_status: Optional[str] = "Pending Enquiry"
    status: Optional[str] = "Initiated"
    dispute: Optional[bool] = False
    documents: Optional[bool] = False
    compensation: Optional[bool] = False

    class Config:
        extra = "allow"


@app.post("/cases", tags=["Cases"])
def create_case_endpoint(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    1. Validates input
    2. Runs real ML delay prediction
    3. Enriches and stores in authoritative database
    4. Returns complete saved case with prediction
    """
    proj_name = payload.get("project_name") or payload.get("name") or "New Acquisition Case"
    district = str(payload.get("district") or payload.get("location") or "Tiruchirappalli").strip()

    # Parse area
    raw_area = payload.get("total_area_ha") or payload.get("area") or 10.0
    try:
        clean_area_str = str(raw_area).replace("ha", "").replace("Ha", "").strip()
        area_ha = float(clean_area_str)
    except Exception:
        area_ha = 10.0

    area_sqft = max(100.0, area_ha * 107639.0)

    # Affected families / owners
    raw_families = payload.get("no_of_families_affected") or payload.get("landowners") or 12
    try:
        families = int(str(raw_families).strip())
    except Exception:
        families = 12

    # Map flags to ML feature schema
    is_dispute = bool(payload.get("dispute") or payload.get("court_case") == "Yes" or payload.get("has_litigation"))
    is_doc_issue = bool(payload.get("documents") or str(payload.get("document_issue", "")).lower().startswith("not"))
    is_comp_issue = bool(payload.get("compensation") or "pending" in str(payload.get("compensation_status", "")).lower())

    land_req = LandRequest(
        area_sqft=area_sqft,
        soil_ph=float(payload.get("soil_ph", 7.0)),
        no_of_owners=max(1, families),
        district=district,
        land_type=str(payload.get("land_type", "Dry")).capitalize(),
        flood_risk="Yes" if payload.get("flood_risk") in (True, "Yes", "yes") else "No",
        water_availability="Yes" if payload.get("water_availability") in (True, "Yes", "yes") else "No",
        soil_type=str(payload.get("soil_type", "Red Soil")),
        document_issue="Not Available" if is_doc_issue else "Available",
        owner_objection="Yes" if payload.get("owner_objection") in (True, "Yes", "yes") else "No",
        court_case="Yes" if is_dispute else "No",
        compensation_status="Pending Enquiry" if is_comp_issue else str(payload.get("compensation_status", "Approved")),
        fmb="Yes",
        a_register="Yes",
        document_verified="No" if is_doc_issue else "Yes",
        objection="Yes" if payload.get("owner_objection") in (True, "Yes", "yes") else "No",
        ownership_type="Individual",
    )

    # Run ML Prediction
    try:
        pred = _run_prediction(land_req)
        predicted_days = pred.predicted_delay_days
        risk_score = pred.risk_score
        risk_category = pred.risk_category
        delay_status = pred.delay_status
        risk_factors = [f.model_dump() for f in pred.risk_factors]
        recommendation = pred.recommendation
    except Exception as exc:
        log.warning("ML prediction failed on case creation; applying deterministic baseline: %s", exc)
        predicted_days = 45.0 if not is_dispute else 135.0
        risk_score = 30 + (40 if is_dispute else 0) + (15 if is_doc_issue else 0)
        risk_category = "High" if risk_score >= 65 else "Medium" if risk_score >= 35 else "Low"
        delay_status = "Delayed" if predicted_days > 90 else "On time"
        risk_factors = []
        recommendation = "Review preliminary documentation and monitor compensation pipeline."

    agency = payload.get("implementing_agency") or payload.get("owner") or "Tamil Nadu Highways"

    # Construct complete operational record
    new_case_doc: Dict[str, Any] = {
        "project_name": proj_name,
        "district": district,
        "state": "Tamil Nadu",
        "title": f"{proj_name}",
        "location": f"{district}, Tamil Nadu",
        "region": district,
        "implementing_agency": agency,
        "owner": agency,
        "total_area_ha": area_ha,
        "area": f"{area_ha} ha",
        "no_of_families_affected": families,
        "landowners": families,
        "stakeholder_count": families,
        "acquisition_purpose": payload.get("acquisition_purpose") or "Infrastructure Development",
        "sector": payload.get("sector") or "Transport",
        "status": payload.get("status") or "Initiated",
        "expected_possession_date": payload.get("expected_possession_date") or "2027-03-31",
        "actual_possession_date": None,
        "delay_days": int(predicted_days),
        "predicted_delay_days": predicted_days,
        "delay_status": delay_status,
        "primary_delay_reason": "Litigation" if is_dispute else "Clearance" if is_doc_issue else "None",
        "primary_delay_detail": "Active challenge before court" if is_dispute else "Clearance enquiry in progress" if is_doc_issue else "Standard process",
        "has_litigation": is_dispute,
        "litigation_forum": "High Court of Madras" if is_dispute else "None",
        "litigation_status": "Pending" if is_dispute else "None",
        "legalDispute": is_dispute,
        "incompleteDocuments": is_doc_issue,
        "compensationPending": is_comp_issue,
        "daysPending": int(predicted_days),
        "activeCourtCase": is_dispute,
        "nextAction": "File counter-affidavit before High Court of Madras" if is_dispute else "Conduct Section 15 enquiry hearing",
        "delay_events": [],
        "disputes": [{"dispute_type": "Writ Petition", "forum": "High Court of Madras", "status": "Pending"}] if is_dispute else [],
        "clearances": [],
        "milestones": [],
        "risk_level": risk_category,
        "risk_category": risk_category,
        "risk_score": risk_score,
        "risk_factors": risk_factors,
        "recommendation": recommendation,
        "total_estimated_cost_cr": payload.get("total_estimated_cost_cr") or round(area_ha * 1.5, 2),
        "notification_date": payload.get("notification_date") or "2026-09-06",
        "larr_applicable": True,
        # Preserve specific ML features for explainability
        "Land_Type": land_req.land_type,
        "Soil_Type": land_req.soil_type,
        "Flood_Risk": land_req.flood_risk,
        "Water_Availability": land_req.water_availability,
        "Owner_Objection": land_req.owner_objection,
        "Compensation_Status": land_req.compensation_status,
        "Document_Verified": land_req.document_verified,
    }

    if payload.get("id"):
        new_case_doc["id"] = payload["id"]
    if payload.get("case_number"):
        new_case_doc["case_number"] = payload["case_number"]

    # Atomically persist to authoritative repository
    try:
        saved = cases_repo.create(new_case_doc)
        return {"success": True, "case": saved}
    except Exception as exc:
        log.exception("Case persistence failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to persist case to authoritative database: {exc}",
        )


@app.get("/cases", tags=["Cases"])
def get_cases_endpoint(
    district: Optional[str] = None,
    delay_status: Optional[str] = None,
    sector: Optional[str] = None,
    has_litigation: Optional[bool] = None,
    risk_category: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_order: str = "desc",
    limit: int = Query(default=1000, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
) -> Dict[str, Any]:
    paged, total = cases_repo.query(
        district=district,
        delay_status=delay_status,
        sector=sector,
        has_litigation=has_litigation,
        risk_category=risk_category,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        limit=limit,
        offset=offset,
    )
    return {"total": total, "limit": limit, "offset": offset, "cases": paged}


@app.get("/cases/{case_id}", tags=["Cases"])
def get_case_by_id_endpoint(case_id: str) -> Dict[str, Any]:
    c = cases_repo.get_by_id(case_id)
    if c:
        return c
    raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found in database")


@app.put("/cases/{case_id}", tags=["Cases"])
def update_case_endpoint(case_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    updated = cases_repo.update(case_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    return {"success": True, "case": updated}


@app.get("/cases/export/excel", tags=["Cases"])
def export_cases_excel_endpoint():
    """Authoritative Database -> Excel export."""
    cases = cases_repo.get_all()
    rows = []
    for c in cases:
        rows.append({
            "Case ID": c.get("id"),
            "Case Number": c.get("case_number"),
            "Project Name": c.get("project_name"),
            "District": c.get("district"),
            "Status": c.get("status"),
            "Total Area (ha)": c.get("total_area_ha"),
            "Affected Families": c.get("no_of_families_affected"),
            "Total Estimated Cost (₹ Cr)": c.get("total_estimated_cost_cr"),
            "Delay Days": c.get("delay_days"),
            "Delay Status": c.get("delay_status"),
            "Risk Score": c.get("risk_score"),
            "Risk Level": c.get("risk_level") or c.get("risk_category"),
            "Litigation": "Yes" if c.get("has_litigation") else "No",
            "Litigation Forum": c.get("litigation_forum"),
            "Primary Delay Reason": c.get("primary_delay_reason"),
            "Implementing Agency": c.get("implementing_agency"),
            "Notification Date": c.get("notification_date"),
            "Created At": c.get("created_at"),
        })

    df = pd.DataFrame(rows)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="AcquiSight_Cases", index=False)
    output.seek(0)

    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=AcquiSight_Land_Acquisition_Cases.xlsx"},
    )


# ---------------------------------------------------------------------------
# Explainable AI Endpoint
# ---------------------------------------------------------------------------

@app.get("/cases/{case_id}/risk-explanation", tags=["Explainability"])
def get_case_risk_explanation_endpoint(case_id: str) -> Dict[str, Any]:
    c = cases_repo.get_by_id(case_id)
    if not c:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    all_cases = cases_repo.get_all()
    return generate_risk_explanation(c, all_cases)


# ---------------------------------------------------------------------------
# Grounded AI Chatbot Endpoint
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    case_id: Optional[str] = None
    conversation_id: Optional[str] = None


@app.post("/chat", tags=["AI Copilot"])
def chat_endpoint(req: ChatRequest) -> Dict[str, Any]:
    try:
        return handle_chat_query(
            message=req.message,
            case_id=req.case_id,
            conversation_id=req.conversation_id,
        )
    except Exception as exc:
        log.exception("Chat query processing failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Safe Machine Learning Retraining Pipeline
# ---------------------------------------------------------------------------

@app.post("/admin/ml/retrain", tags=["ML Administration"])
@app.post("/ml/retrain", tags=["ML Administration"])
def retrain_endpoint(current_user: Optional[OfficerUser] = Depends(get_current_user)) -> Dict[str, Any]:
    officer_name = current_user.name if current_user else "Authorized Officer"
    try:
        return execute_safe_retrain(triggered_by=officer_name)
    except Exception as exc:
        log.exception("Safe retrain pipeline encountered error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Retraining pipeline failed: {exc}") from exc


@app.get("/ml/status", tags=["ML Administration"])
def ml_status_endpoint() -> Dict[str, Any]:
    return get_retrain_status()


# ---------------------------------------------------------------------------
# Dashboard Summary & Live Analytics (Dynamic from Repository)
# ---------------------------------------------------------------------------

@app.get("/dashboard/summary", tags=["Dashboard"])
def get_dashboard_summary_endpoint() -> Dict[str, Any]:
    cases = cases_repo.get_all()
    total = len(cases)
    delayed = sum(1 for c in cases if c.get("delay_status") == "Delayed" or (c.get("delay_days") or 0) > 90)
    moderate = sum(1 for c in cases if c.get("delay_status") == "Moderate Delay" or (0 < (c.get("delay_days") or 0) <= 90))
    on_time = sum(1 for c in cases if c.get("delay_status") == "On time" or (c.get("delay_days") or 0) == 0)
    litigated = sum(1 for c in cases if c.get("has_litigation") or (c.get("disputes") and len(c.get("disputes")) > 0))
    total_families = sum(int(c.get("no_of_families_affected") or c.get("landowners") or 0) for c in cases)
    total_area = round(sum(float(c.get("total_area_ha") or 0) for c in cases), 2)
    total_cost = round(sum(float(c.get("total_estimated_cost_cr") or 0) for c in cases), 2)

    delayed_items = [c for c in cases if (c.get("delay_days") or 0) > 0]
    avg_delay = round(sum(c.get("delay_days", 0) for c in delayed_items) / len(delayed_items), 1) if delayed_items else 0

    _completed_statuses = {"completed", "possession taken", "award declared"}
    completed_cases = sum(
        1 for c in cases
        if str(c.get("status") or c.get("acquisition_status") or "").strip().lower() in _completed_statuses
    )

    dist_map: Dict[str, Dict[str, Any]] = {}
    for c in cases:
        d = str(c.get("district") or "Unknown")
        if d not in dist_map:
            dist_map[d] = {"district": d, "total": 0, "delayed": 0, "litigated": 0, "delay_sum": 0, "area_ha": 0.0}
        dist_map[d]["total"] += 1
        dist_map[d]["area_ha"] += float(c.get("total_area_ha") or 0)
        if c.get("delay_status") == "Delayed" or (c.get("delay_days") or 0) > 90:
            dist_map[d]["delayed"] += 1
        if c.get("has_litigation"):
            dist_map[d]["litigated"] += 1
        dist_map[d]["delay_sum"] += int(c.get("delay_days") or 0)

    district_ranking = []
    for d, info in dist_map.items():
        avg_d = round(info["delay_sum"] / info["total"], 1) if info["total"] > 0 else 0
        district_ranking.append({
            "district": d,
            "total": info["total"],
            "delayed": info["delayed"],
            "litigated": info["litigated"],
            "avg_delay_days": avg_d,
            "area_ha": round(info["area_ha"], 2),
        })
    district_ranking.sort(key=lambda x: x["delayed"], reverse=True)

    return {
        "total_cases": total,
        "delayed_cases": delayed,
        "moderate_delay_cases": moderate,
        "on_time_cases": on_time,
        "litigated_cases": litigated,
        "completed_cases": completed_cases,
        "total_families_affected": total_families,
        "total_area_ha": total_area,
        "total_cost_cr": total_cost,
        "avg_delay_days": avg_delay,
        "monitored_districts_count": len(dist_map),
        "district_delay_ranking": district_ranking[:10],
    }


@app.get("/cases/summary", tags=["Cases"])
def get_cases_summary_endpoint() -> Dict[str, Any]:
    return get_dashboard_summary_endpoint()


@app.get("/alerts", tags=["Alerts"])
def get_alerts_endpoint(limit: int = 25) -> List[Dict[str, Any]]:
    cases = cases_repo.get_all()
    alerts = []
    for c in cases:
        if c.get("has_litigation") and c.get("disputes"):
            disp = c["disputes"][0]
            cid = c.get("id") or str(c.get("la_case_id"))
            alerts.append({
                "id": f"alert-lit-{c.get('la_case_id', cid)}",
                "caseId": c.get("case_number") or cid,
                "case_id": cid,
                "district": c.get("district", "Tamil Nadu"),
                "title": f"Active dispute at {c.get('litigation_forum', 'High Court of Madras')}",
                "detail": disp.get("outcome_summary") or f"Litigation pending for {c.get('project_name')} ({c.get('district')})",
                "severity": "Critical",
                "time": f"Filed {disp.get('filing_date')}" if disp.get("filing_date") else "Active",
                "type": "Legal",
            })
    for c in cases:
        days = int(c.get("delay_days") or 0)
        if days > 120 and not c.get("has_litigation"):
            cid = c.get("id") or str(c.get("la_case_id"))
            alerts.append({
                "id": f"alert-del-{c.get('la_case_id', cid)}",
                "caseId": c.get("case_number") or cid,
                "case_id": cid,
                "district": c.get("district", "Tamil Nadu"),
                "title": f"Exceeded statutory delay SLA: {days} days",
                "detail": f"{c.get('primary_delay_reason', 'Clearance issue')}: {c.get('primary_delay_detail', 'Milestone pending')} in {c.get('district')}",
                "severity": "High",
                "time": f"{days}d delay",
                "type": "Timeline",
            })
    alerts.sort(key=lambda x: (0 if x["severity"] == "Critical" else 1, x["id"]))
    return alerts[:limit]


@app.get("/analytics/districts", tags=["Analytics"])
def get_analytics_districts_endpoint() -> List[Dict[str, Any]]:
    summary = get_dashboard_summary_endpoint()
    return summary.get("district_delay_ranking", [])


@app.get("/analytics/risk-distribution", tags=["Analytics"])
def get_analytics_risk_distribution_endpoint() -> Dict[str, Any]:
    cases = cases_repo.get_all()
    risk_counts = {"Low": 0, "Medium": 0, "High": 0}
    delay_counts = {"Delayed": 0, "Moderate Delay": 0, "On time": 0}
    sector_counts: Dict[str, int] = {}
    for c in cases:
        r = c.get("risk_level") or c.get("risk_category")
        if not r:
            days = int(c.get("delay_days") or 0)
            r = "High" if (c.get("has_litigation") or days > 120) else "Medium" if days > 0 else "Low"
        if r in risk_counts:
            risk_counts[r] += 1
        ds = str(c.get("delay_status") or "On time")
        if "delayed" in ds.lower():
            delay_counts["Delayed"] += 1
        elif "moderate" in ds.lower():
            delay_counts["Moderate Delay"] += 1
        else:
            delay_counts["On time"] += 1
        s = c.get("sector") or "Infrastructure"
        sector_counts[s] = sector_counts.get(s, 0) + 1

    return {
        "risk_distribution": [{"name": k, "value": v} for k, v in risk_counts.items()],
        "delay_distribution": [{"name": k, "value": v} for k, v in delay_counts.items()],
        "sector_distribution": [{"name": k, "value": v} for k, v in sorted(sector_counts.items(), key=lambda x: x[1], reverse=True)],
    }


@app.get("/analytics/delay-causes", tags=["Analytics"])
def get_analytics_delay_causes_endpoint(limit: int = 12) -> List[Dict[str, Any]]:
    cases = cases_repo.get_all()
    reason_counts: Dict[str, int] = {}
    for c in cases:
        reason = str(c.get("primary_delay_reason") or "Unknown")
        if reason and reason.lower() not in ("none", "n/a", "unknown", "nan"):
            reason_counts[reason] = reason_counts.get(reason, 0) + 1
    sorted_reasons = sorted(reason_counts.items(), key=lambda x: x[1], reverse=True)
    return [{"name": r, "count": cnt} for r, cnt in sorted_reasons[:limit]]


@app.get("/analytics/status-distribution", tags=["Analytics"])
def get_analytics_status_distribution_endpoint() -> List[Dict[str, Any]]:
    cases = cases_repo.get_all()
    status_counts: Dict[str, int] = {}
    for c in cases:
        status_val = str(c.get("status") or c.get("acquisition_status") or "Unknown")
        status_counts[status_val] = status_counts.get(status_val, 0) + 1
    sorted_statuses = sorted(status_counts.items(), key=lambda x: x[1], reverse=True)
    return [{"status": s, "count": cnt} for s, cnt in sorted_statuses[:10]]


@app.get("/actions", tags=["Actions"])
def get_actions_endpoint(limit: int = 20) -> List[Dict[str, Any]]:
    cases = cases_repo.get_all()
    actions = []

    # Priority 1: litigated cases needing legal response
    for c in cases:
        if not c.get("has_litigation"):
            continue
        disputes = c.get("disputes") or []
        forum = c.get("litigation_forum") or "High Court of Madras"
        disp_info = disputes[0] if disputes else {}
        cid = str(c.get("id") or c.get("la_case_id"))
        actions.append({
            "id": f"act-lit-{cid}",
            "title": f"Respond to {disp_info.get('dispute_type', 'court')} dispute at {forum}",
            "caseId": c.get("case_number") or cid,
            "case_id": cid,
            "district": c.get("district", ""),
            "owner": f"DRO {c.get('district', 'Office')}",
            "due": "Urgent",
            "priority": "Urgent",
            "detail": (
                disp_info.get("outcome_summary")
                or f"Legal action required for {c.get('project_name', 'this case')} ({c.get('district', '')})"
            ),
            "type": "Legal",
        })
        if len(actions) >= limit // 2:
            break

    # Priority 2: severely delayed cases needing clearance push
    delayed = sorted(
        [c for c in cases if int(c.get("delay_days") or 0) > 120 and not c.get("has_litigation")],
        key=lambda x: int(x.get("delay_days") or 0),
        reverse=True,
    )
    for c in delayed:
        days = int(c.get("delay_days") or 0)
        cid = str(c.get("id") or c.get("la_case_id"))
        actions.append({
            "id": f"act-del-{cid}",
            "title": f"Escalate SLA breach: {c.get('primary_delay_reason', 'Clearance issue')} ({days}d delay)",
            "caseId": c.get("case_number") or cid,
            "case_id": cid,
            "district": c.get("district", ""),
            "owner": f"Special LA Officer, {c.get('district', 'Office')}",
            "due": f"{days}d overdue",
            "priority": "High" if days < 200 else "Urgent",
            "detail": c.get("primary_delay_detail") or f"Resolve {c.get('primary_delay_reason', 'pending clearance')} for {c.get('project_name', 'this case')}",
            "type": "Timeline",
        })
        if len(actions) >= limit:
            break

    return actions[:limit]


# ---------------------------------------------------------------------------
# GIS Endpoints
# ---------------------------------------------------------------------------

@app.get("/gis/summary", tags=["GIS"])
def get_gis_summary_endpoint() -> Dict[str, Any]:
    path = SCORED_CSV if SCORED_CSV.exists() else CLEANED_CSV
    if path.exists():
        df = pd.read_csv(path)
        delay = pd.to_numeric(df.get("Acquisition_Days"), errors="coerce")
        return {
            "total_parcels": int(len(df)),
            "districts": int(df["District"].nunique()) if "District" in df.columns else 0,
            "villages": int(df["Village"].nunique()) if "Village" in df.columns else 0,
            "avg_acquisition_days": round(float(delay.mean()), 2) if delay.notna().any() else None,
            "coordinate_note": "Official gazette records have no survey coordinates; map points are approximate district/village centroids.",
        }
    if not _GIS_PARCELS_CSV.exists():
        raise HTTPException(status_code=404, detail="GIS dataset not found")
    df = pd.read_csv(_GIS_PARCELS_CSV)
    return {
        "total_parcels": int(len(df)),
        "districts": int(df["district"].nunique()),
        "villages": int(df["village_name"].nunique()),
        "total_area_ha": round(float(df["area_ha"].sum()), 2),
        "avg_market_value": round(float(df["market_value_per_ha_inr"].mean()), 2),
        "avg_compensation": round(float(df["compensation_rate_per_ha_inr"].mean()), 2),
    }


@app.get("/gis/filters", tags=["GIS"])
def get_gis_filters_endpoint() -> Dict[str, Any]:
    path = SCORED_CSV if SCORED_CSV.exists() else CLEANED_CSV
    if path.exists():
        df = pd.read_csv(path)
        districts = sorted(df["District"].dropna().astype(str).unique().tolist())
        taluks_by_district: Dict[str, List[str]] = {}
        for d in districts:
            taluks_by_district[d] = sorted(df.loc[df["District"].astype(str) == d, "Taluk"].dropna().astype(str).unique().tolist())
        return {
            "districts": districts,
            "taluks_by_district": taluks_by_district,
            "risk_categories": ["Low", "Medium", "High"],
            "delay_status": sorted(df["Delay_Status"].dropna().astype(str).unique().tolist()) if "Delay_Status" in df.columns else [],
        }
    if not _GIS_PARCELS_CSV.exists():
        raise HTTPException(status_code=404, detail="GIS dataset not found")
    df = pd.read_csv(_GIS_PARCELS_CSV)
    districts = sorted([str(d) for d in df["district"].dropna().unique()])
    taluks_by_district = {
        d: sorted([str(t) for t in df[df["district"] == d]["tehsil"].dropna().unique()]) for d in districts
    }
    return {
        "districts": districts,
        "taluks_by_district": taluks_by_district,
        "land_uses": sorted([str(u) for u in df["land_use_type"].dropna().unique()]),
    }


@app.get("/gis/parcels", tags=["GIS"])
def get_gis_parcels_endpoint(
    district: Optional[str] = None,
    taluk: Optional[str] = None,
    land_use: Optional[str] = None,
    risk_category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=1000, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
) -> Dict[str, Any]:
    path = SCORED_CSV if SCORED_CSV.exists() else _GIS_PARCELS_CSV
    if not path.exists():
        raise HTTPException(status_code=404, detail="GIS dataset not found")
    df = pd.read_csv(path)
    district_col = "District" if "District" in df.columns else "district"
    taluk_col = "Taluk" if "Taluk" in df.columns else "tehsil"
    if district and district != "All Districts" and district_col in df.columns:
        df = df[df[district_col].astype(str) == district]
    if taluk and taluk != "All Taluks" and taluk_col in df.columns:
        df = df[df[taluk_col].astype(str) == taluk]
    if land_use and land_use != "All Land Uses" and "land_use_type" in df.columns:
        df = df[df["land_use_type"].astype(str) == land_use]
    if risk_category and risk_category != "All Risk Categories":
        risk_col = "Predicted_Risk_Category" if "Predicted_Risk_Category" in df.columns else None
        if risk_col:
            df = df[df[risk_col].astype(str) == risk_category]
    if search and search.strip():
        s = search.strip().lower()
        mask = False
        for col in ["Land_ID", "Village", "Taluk", "District", "parcel_id", "village_name"]:
            if col in df.columns:
                mask = mask | df[col].astype(str).str.lower().str.contains(s, na=False)
        df = df[mask]
    total = len(df)
    paged = df.iloc[offset : offset + limit].fillna("").to_dict(orient="records")
    return {"total": total, "limit": limit, "offset": offset, "parcels": paged}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
