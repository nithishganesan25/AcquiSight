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

_SRC = Path(__file__).resolve().parent
_ROOT = _SRC.parent
DATA_DIR = _ROOT / "data"

PRIMARY_EXCEL = DATA_DIR / "land acquisition_01.xlsx"
CLEANED_CSV = DATA_DIR / "cleaned_land_records.csv"
CATEGORIES_JSON = DATA_DIR / "feature_categories.json"

log = logging.getLogger("prepare_real_data")

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
        "primary_excel": str(PRIMARY_EXCEL.name),
        "notes": {
            "Delay_Risk_Band": "Derived from Acquisition_Days (Low<=60, Medium<=120, High>120). Not a recorded official risk label.",
            "Delay_Status": "Recorded binary label from Acquisition_Delay sheet (No Delay / Delayed).",
            "Acquisition_Days": "Recorded acquisition duration from Acquisition_Delay sheet.",
            "coordinates": "Official gazette workbook has no latitude/longitude.",
        },
    }
    CATEGORIES_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(CATEGORIES_JSON, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)
    return payload


def prepare() -> pd.DataFrame:
    excel_path = find_primary_excel()
    raw = load_and_join(excel_path)
    cleaned = clean_frame(raw)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    cleaned.to_csv(CLEANED_CSV, index=False)
    save_categories(cleaned)
    log.info("Saved cleaned dataset -> %s", CLEANED_CSV)
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
