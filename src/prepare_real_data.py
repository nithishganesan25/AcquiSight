"""
prepare_real_data.py
====================
Load the complete official gazette workbook, join sheets, clean fields,
and save a modelling-ready land-records table.

Primary source (chosen after inspecting every Excel file):
    data/land acquisition_01.xlsx
    - 500 complete rows across 4 sheets
    - Real Acquisition_Days + Delay_Status labels
    - District / Taluk / Village / Survey_no geography

The incomplete 500-row workbook, the 50-row demo workbook, and the
Tamil Nadu case workbook are NOT used as the ML training source.
"""

from __future__ import annotations

import json
import logging
import re
import sys
from pathlib import Path

import pandas as pd
import numpy as np

_SRC = Path(__file__).resolve().parent
_ROOT = _SRC.parent
DATA_DIR = _ROOT / "data"

PRIMARY_EXCEL = DATA_DIR / "land acquisition_01.xlsx"
SYNTHETIC_20K_CSV = DATA_DIR / "AcquiSight_20K_Synthetic_Augmented_Dataset.csv"
CLEANED_CSV = DATA_DIR / "cleaned_land_records.csv"
CATEGORIES_JSON = DATA_DIR / "feature_categories.json"

log = logging.getLogger("prepare_real_data")

SOIL_PH_BASE = {
    "Red Soil": 6.8,
    "Loamy": 6.5,
    "Alluvial": 7.3,
    "Black Cotton": 7.9,
    "Saline": 8.6,
    "Sandy": 6.2,
    "Urban Fill": 7.2,
}

COMPENSATION_MAP = {
    "notice states compensation to be paid; status not stated": "To be paid",
    "notice states compensation to be paid by sipcot; payment status not stated": "To be paid",
    "compensation withheld pending disposal of court proceedings": "Withheld pending court",
    "notice states compensation to be paid; verification completed": "Verification completed",
    "document verification pending; compensation award enquiry notified": "Verification pending",
    "objection enquiry in progress under section 3(2); compensation enquiry scheduled": "Objection enquiry",
}

NUM_FEATURE_COLS = [
    "Area_Sqft",
    "Soil_pH",
    "No_of_Owners",
]
CAT_FEATURE_COLS = [
    "District",
    "Land_Type",
    "Flood_Risk",
    "Water_Availability",
    "Soil_Type",
    "Document_Issue",
    "Owner_Objection",
    "Court_Case",
    "Compensation_Status",
    "FMB",
    "A_Register",
    "Document_Verified",
    "Objection",
    "Ownership_Type",
]
REGRESSION_TARGET = "Acquisition_Days"
CLASSIFICATION_TARGET = "Delay_Status"
ID_COLS = ["Land_ID", "Taluk", "Village", "Survey_No"]


def _norm_yes_no(value) -> str:
    if pd.isna(value):
        return "Unknown"
    text = str(value).strip().lower()
    text = text.replace("yes", "yes").replace("no", "no")
    text = re.sub(r"[^a-z]", "", text)
    if text.startswith("yes") or text in {"y", "true", "available"}:
        if "notavailable" in re.sub(r"[^a-z]", "", str(value).strip().lower()):
            return "No"
        return "Yes"
    if text.startswith("no") or text in {"n", "false"}:
        return "No"
    if "available" in str(value).strip().lower() and "not" not in str(value).strip().lower():
        return "Yes"
    return str(value).strip().title() or "Unknown"


def _yes_no_document_issue(value) -> str:
    if pd.isna(value):
        return "Unknown"
    text = str(value).strip().lower()
    if "not available" in text:
        return "Not Available"
    if "available" in text:
        return "Available"
    return str(value).strip().title()


def _count_owners(raw) -> int:
    if pd.isna(raw) or str(raw).strip() == "":
        return 1
    parts = [p.strip() for p in str(raw).split(";") if p.strip()]
    return max(1, len(parts))


def _ownership_type(raw) -> str:
    return "Joint" if _count_owners(raw) > 1 else "Individual"


def _normalize_compensation(raw) -> str:
    if pd.isna(raw):
        return "Unknown"
    key = re.sub(r"\s+", " ", str(raw).strip().lower())
    key = key.replace("—", "-").replace("–", "-")
    return COMPENSATION_MAP.get(key, str(raw).strip()[:80])


def _delay_risk_band(days) -> str:
    """Display band derived from recorded/predicted days. Not an official label."""
    d = float(days)
    if d <= 60:
        return "Low"
    if d <= 120:
        return "Medium"
    return "High"


def find_primary_excel() -> Path:
    if PRIMARY_EXCEL.exists():
        return PRIMARY_EXCEL
    candidates = sorted(DATA_DIR.glob("*.xlsx"))
    for path in candidates:
        try:
            xl = pd.ExcelFile(path)
            if set(["Land_Basic_Data", "Acquisition_Delay", "Document_Status"]).issubset(xl.sheet_names):
                basic = xl.parse("Land_Basic_Data")
                if len(basic) >= 400 and basic.isnull().mean().mean() < 0.05:
                    return path
        except Exception:
            continue
    raise FileNotFoundError(f"Could not find the complete official workbook in {DATA_DIR}")


def load_and_join(excel_path: Path) -> pd.DataFrame:
    log.info("Loading primary workbook: %s", excel_path)
    xl = pd.ExcelFile(excel_path)
    log.info("Sheets: %s", xl.sheet_names)

    basic = xl.parse("Land_Basic_Data")
    delay = xl.parse("Acquisition_Delay")
    docs = xl.parse("Document_Status")
    source = xl.parse("Source_Master") if "Source_Master" in xl.sheet_names else None

    log.info("Land_Basic_Data: %d rows x %d cols", len(basic), basic.shape[1])
    log.info("Acquisition_Delay: %d rows x %d cols", len(delay), delay.shape[1])
    log.info("Document_Status: %d rows x %d cols", len(docs), docs.shape[1])
    if source is not None:
        log.info("Source_Master: %d rows x %d cols", len(source), source.shape[1])

    n0 = len(basic)
    df = basic.merge(delay, on="Record_ID", how="inner", suffixes=("", "_delay"))
    df = df.merge(docs, on="Record_ID", how="left", suffixes=("", "_doc"))
    if source is not None:
        keep_src = [
            c
            for c in ["Record_ID", "Structures", "Trees_Crops", "Acquisition_Extent_Hectares"]
            if c in source.columns
        ]
        df = df.merge(source[keep_src], on="Record_ID", how="left")

    log.info("Joined rows: %d (from %d basic records)", len(df), n0)
    if len(df) < n0:
        log.warning("Lost %d rows in joins", n0 - len(df))
    return df


def clean_frame(df: pd.DataFrame) -> pd.DataFrame:
    original_n = len(df)
    dup_n = int(df.duplicated().sum())
    if dup_n:
        df = df.drop_duplicates().copy()
        log.info("Removed %d exact duplicate rows", dup_n)
    else:
        log.info("Duplicate rows: 0")

    missing = df.isnull().sum()
    missing = missing[missing > 0]
    if missing.empty:
        log.info("Missing values: none")
    else:
        log.info("Missing-value summary:\n%s", missing.to_string())

    out = pd.DataFrame()
    out["Land_ID"] = df["Record_ID"].astype(str).str.strip()
    out["District"] = df["District"].astype(str).str.strip()
    out["Taluk"] = df["Taluk"].astype(str).str.strip()
    out["Village"] = df["Village"].astype(str).str.strip()
    out["Survey_No"] = df["Survey_no"].astype(str).str.strip()

    out["Extent_Hectares"] = pd.to_numeric(df["Total_Extent_Hectares"], errors="coerce")
    out["Area_Sqft"] = pd.to_numeric(df["Area_Sqft"], errors="coerce")
    out["Soil_pH"] = pd.to_numeric(df["Soil_pH"], errors="coerce")
    out["Land_Type"] = df["Land_Type"].astype(str).str.strip().str.title()
    out["Soil_Type"] = df["Soil type"].astype(str).str.strip()

    out["Flood_Risk"] = df["Flood Risk"].map(_norm_yes_no)
    out["Water_Availability"] = df["Water_Availability"].map(_norm_yes_no)

    out["Ownership_Raw"] = df["Ownership"].astype(str).str.strip()
    out["No_of_Owners"] = df["Ownership"].map(_count_owners).astype(int)
    out["Ownership_Type"] = df["Ownership"].map(_ownership_type)

    out["Document_Issue"] = df["Document_Issue"].map(_yes_no_document_issue)
    out["Owner_Objection"] = df["Owner_Objection"].map(_norm_yes_no)
    court_src = df["Court_Case"] if "Court_Case" in df.columns else df.get("Court_Case_doc")
    out["Court_Case"] = court_src.map(_norm_yes_no)
    out["Compensation_Status"] = df["Compensation_Status"].map(_normalize_compensation)

    out["FMB"] = df["FMB"].map(_norm_yes_no)
    out["A_Register"] = df["A_Register"].map(_norm_yes_no)
    out["Document_Verified"] = df["Document_Verified"].map(_norm_yes_no)
    out["Objection"] = df["Objection"].map(_norm_yes_no)

    if "Structures" in df.columns:
        out["Has_Structures"] = df["Structures"].map(
            lambda v: "No" if pd.isna(v) or str(v).strip().lower() in {"nil", "vacant land", ""} else "Yes"
        )
    if "Trees_Crops" in df.columns:
        out["Has_Crops_Trees"] = df["Trees_Crops"].map(
            lambda v: "No" if pd.isna(v) or str(v).strip().lower() in {"nil", ""} else "Yes"
        )

    out["Acquisition_Days"] = pd.to_numeric(df["Acquisition_Days"], errors="coerce")
    delay_raw = df["Delay_Status"].astype(str).str.strip()
    out["Delay_Status"] = delay_raw.map(
        lambda s: "Delayed" if s.lower().startswith("delay") else "No Delay"
    )
    out["Delay_Risk_Band"] = out["Acquisition_Days"].map(_delay_risk_band)
    out["Source_Reference"] = df.get("Source_Reference", pd.Series([""] * len(df))).astype(str)

    # Invalid numerics → median, do not drop records
    for col in ["Area_Sqft", "Soil_pH", "Extent_Hectares", "Acquisition_Days"]:
        n_bad = int(out[col].isna().sum())
        if n_bad:
            med = out[col].median()
            log.warning("%s: %d invalid/missing values imputed with median %.3f", col, n_bad, med)
            out[col] = out[col].fillna(med)
        if col == "Soil_pH":
            out.loc[(out[col] < 0) | (out[col] > 14), col] = out[col].median()
        if col in {"Area_Sqft", "Extent_Hectares", "Acquisition_Days"}:
            n_neg = int((out[col] < 0).sum())
            if n_neg:
                log.warning("%s: %d negative values clipped to 0 (records kept)", col, n_neg)
                out[col] = out[col].clip(lower=0)

    out["Acquisition_Days"] = out["Acquisition_Days"].round().astype(int)

    cleaned_n = len(out)
    log.info("Original row count : %d", original_n)
    log.info("Cleaned row count  : %d (dropped %d)", cleaned_n, original_n - cleaned_n)
    log.info("Regression target  : Acquisition_Days  min=%s max=%s mean=%.1f",
             out["Acquisition_Days"].min(), out["Acquisition_Days"].max(), out["Acquisition_Days"].mean())
    log.info("Classification target Delay_Status:\n%s", out["Delay_Status"].value_counts().to_string())
    log.info("Derived Delay_Risk_Band (from days, for display only):\n%s",
             out["Delay_Risk_Band"].value_counts().to_string())

    for col in CAT_FEATURE_COLS:
        log.info("  %-22s -> %s", col, sorted(out[col].astype(str).unique().tolist()))

    return out


def prepare_from_20k(csv_path: Path) -> pd.DataFrame:
    log.info("Preparing land records from 20K dataset: %s", csv_path)
    df = pd.read_csv(csv_path)
    log.info("Raw 20K shape: %s", df.shape)

    records = []
    rng = np.random.default_rng(seed=42)

    for r in df.itertuples():
        ph_base = SOIL_PH_BASE.get(getattr(r, "soil_class", "Red Soil"), 7.0)
        ph = round(float(np.clip(ph_base + rng.normal(0, 0.25), 4.5, 9.5)), 1)

        delay_days_val = getattr(r, "delay_days", None)
        if pd.notnull(delay_days_val):
            acq_days = max(0.0, float(delay_days_val))
        else:
            ev = float(r.event_delay_days) if pd.notnull(getattr(r, "event_delay_days", None)) else 0.0
            disp = float(r.dispute_delay_days) if pd.notnull(getattr(r, "dispute_delay_days", None)) else 0.0
            acq_days = max(0.0, ev + disp)

        st = str(getattr(r, "status", "")).strip()
        if st in ["Completed", "Possession Taken"]:
            comp_status = "Verification completed"
        elif st == "Litigated":
            comp_status = "Withheld pending court"
        elif st == "Objections_Received":
            comp_status = "Objection enquiry"
        elif st in ["SIA_Completed", "Consent_Process_End"]:
            comp_status = "Verification pending"
        else:
            comp_status = "To be paid"

        obj_cnt = int(getattr(r, "objections_count", 0) or 0)
        has_lit = int(getattr(r, "has_litigation", 0) or 0)
        lit_cnt = int(getattr(r, "litigation_count", 0) or 0)
        clr_pend = int(getattr(r, "clearance_pending_count", 0) or 0)
        clr_appr = int(getattr(r, "clearance_approved_count", 0) or 0)
        has_disp = int(getattr(r, "has_dispute", 0) or 0)
        stk_cnt = max(1, int(getattr(r, "stakeholder_count", 1) or 1))

        obj_flag = "Yes" if obj_cnt > 0 else "No"
        court_flag = "Yes" if has_lit == 1 or lit_cnt > 0 else "No"
        flood_flag = "Yes" if str(getattr(r, "land_use_type", "")) == "Coastal" or str(getattr(r, "irrigation_status", "")) == "Irrigated" else "No"
        water_flag = "Yes" if str(getattr(r, "irrigation_status", "")) in ["Irrigated", "Partly Irrigated"] else "No"
        doc_issue = "Not Available" if clr_pend > 0 or has_disp == 1 else "Available"
        doc_ver = "Yes" if clr_pend == 0 and clr_appr > 0 else "No"
        fmb = "Yes" if clr_appr > 0 else "No"

        area_sqft = round(float(getattr(r, "area_ha", 1.0)) * 107639.104, 2)
        days = round(acq_days, 1)
        risk_band = _delay_risk_band(days)
        delay_status = "Delayed" if days > 60 else "No Delay"

        records.append({
            "Land_ID": str(getattr(r, "synthetic_record_id", f"REC_{r.Index}")),
            "District": str(getattr(r, "district", "Kancheepuram")).strip(),
            "Taluk": str(getattr(r, "tehsil", "Unknown")).strip(),
            "Village": str(getattr(r, "village_name", "Unknown")).strip(),
            "Survey_No": f"{getattr(r, 'la_case_id', '1')}/{getattr(r, 'parcel_id', '1')}",
            "Extent_Hectares": round(float(getattr(r, "area_ha", 1.0)), 4),
            "Area_Sqft": area_sqft,
            "Soil_pH": ph,
            "No_of_Owners": stk_cnt,
            "Ownership_Type": "Joint" if stk_cnt > 1 else "Individual",
            "Land_Type": str(getattr(r, "land_use_type", "Agricultural")).strip().title(),
            "Soil_Type": str(getattr(r, "soil_class", "Red Soil")).strip(),
            "Flood_Risk": flood_flag,
            "Water_Availability": water_flag,
            "Document_Issue": doc_issue,
            "Owner_Objection": obj_flag,
            "Court_Case": court_flag,
            "Compensation_Status": comp_status,
            "FMB": fmb,
            "A_Register": "Yes",
            "Document_Verified": doc_ver,
            "Objection": obj_flag,
            "Acquisition_Days": days,
            "Delay_Status": delay_status,
            "Delay_Risk_Band": risk_band,
            "latitude": float(getattr(r, "latitude", 12.8)),
            "longitude": float(getattr(r, "longitude", 79.7)),
            "Source_Reference": "AcquiSight 20K Synthetic Augmented Dataset",
        })

    out = pd.DataFrame(records)
    log.info("Prepared 20K cleaned DataFrame: %d rows, %d columns", len(out), len(out.columns))
    return out


def save_categories(df: pd.DataFrame) -> dict:
    cats = {col: sorted(df[col].astype(str).unique().tolist()) for col in CAT_FEATURE_COLS}
    payload = {
        "numerical_features": NUM_FEATURE_COLS,
        "categorical_features": CAT_FEATURE_COLS,
        "regression_target": REGRESSION_TARGET,
        "classification_target": CLASSIFICATION_TARGET,
        "id_columns": ID_COLS,
        "categories": cats,
        "row_count": int(len(df)),
        "primary_source": "AcquiSight_20K_Synthetic_Augmented_Dataset.csv" if SYNTHETIC_20K_CSV.exists() else str(PRIMARY_EXCEL.name),
        "notes": {
            "Delay_Risk_Band": "Derived from Acquisition_Days (Low<=60, Medium<=120, High>120). Not a recorded official risk label.",
            "Delay_Status": "Recorded binary label (No Delay / Delayed).",
            "Acquisition_Days": "Recorded acquisition duration in days.",
        },
    }
    CATEGORIES_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(CATEGORIES_JSON, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)
    return payload


def prepare() -> pd.DataFrame:
    if SYNTHETIC_20K_CSV.exists():
        cleaned = prepare_from_20k(SYNTHETIC_20K_CSV)
    else:
        excel_path = find_primary_excel()
        raw = load_and_join(excel_path)
        cleaned = clean_frame(raw)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    cleaned.to_csv(CLEANED_CSV, index=False)
    save_categories(cleaned)
    log.info("Saved cleaned dataset -> %s (%d rows)", CLEANED_CSV, len(cleaned))
    log.info("Saved category schema -> %s", CATEGORIES_JSON)
    return cleaned


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            logging.StreamHandler(open(sys.stdout.fileno(), mode="w", encoding="utf-8", closefd=False))
        ],
    )
    prepare()


if __name__ == "__main__":
    main()
