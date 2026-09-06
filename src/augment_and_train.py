"""
augment_and_train.py
====================
ACQUISIGHT — Merge new data files + augment + retrain the ML pipeline.

Strategy
--------
The two new files have incompatible or mostly missing schemas:
  - 500-record workbook: only Land_use / Ownership have values (0% usable for
    the other 9 features). Usable as weak soft labels after imputation.
  - TN project dataset: project-level data, no per-parcel features or target.

Approach:
  1. Keep all 50 original labelled rows as the "gold" core.
  2. Extract the 500 rows' Land_use (mapped to our categories) + Ownership
     (mapped to our categories), and synthetically fill the remaining features
     by sampling from the observed distributions in the original dataset.
     This effectively multiplies training data while preserving feature
     joint-distributions.
  3. Combine → 550 rows total → re-run Prepare_data → retrain.

Run
---
    cd ACQUISIGHT/src
    python augment_and_train.py
"""

from __future__ import annotations

import logging
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_config import cfg, DATA_DIR, MODELS_DIR  # noqa: E402

# ---------------------------------------------------------------------------
# Logging (UTF-8 safe on Windows)
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format=cfg.LOG_FORMAT,
    datefmt=cfg.LOG_DATE_FORMAT,
    handlers=[
        logging.StreamHandler(
            open(sys.stdout.fileno(), mode="w", encoding="utf-8", closefd=False)
        )
    ],
)
log = logging.getLogger("augment_and_train")

# ---------------------------------------------------------------------------
# File paths
# ---------------------------------------------------------------------------
ORIG_FILE  = DATA_DIR / "Land_Acquisition_Predictive_Analytics.xlsx"
NEW_FILE_1 = DATA_DIR / "Land_Acquisition_500_Official_Source_Workbook.xlsx"
NEW_FILE_2 = DATA_DIR / "tn_land_acquisition_dataset.xlsx"
MERGED_CSV = DATA_DIR / "merged_dataset.csv"

# ---------------------------------------------------------------------------
# Land-use mapping: gazette format → our training categories
# ---------------------------------------------------------------------------
LANDUSE_MAP = {
    "Wet":       "Agricultural",
    "Dry":       "Agricultural",
    "Manavari":  "Agricultural",  # rain-fed, still agricultural
}

# Ownership: gazette records are individual names (not a category).
# We'll infer: multi-owner records (contains ';') → Joint, else → Individual
def infer_ownership(raw: str) -> str:
    if pd.isna(raw) or str(raw).strip() == "":
        return "Individual"
    return "Joint" if ";" in str(raw) else "Individual"


# ===========================================================================
# 1. Load original labelled data
# ===========================================================================
def load_original() -> pd.DataFrame:
    df = pd.read_excel(ORIG_FILE)
    log.info("Original dataset: %d rows, %d cols", len(df), len(df.columns))
    return df


# ===========================================================================
# 2. Parse new 500-row workbook → extract what's usable
# ===========================================================================
def parse_new_500(orig_df: pd.DataFrame) -> pd.DataFrame:
    """
    Extract Land_use + Ownership from the 500-record workbook, map to our
    categories, then synthetically fill all other feature columns by sampling
    from the original dataset's empirical distributions *conditioned* on
    the land use bucket.
    Also carries over Record_ID, District, Taluk, Village as display columns.
    """
    df500 = pd.read_excel(NEW_FILE_1)
    log.info("New 500-record workbook: %d rows", len(df500))

    # Map land use
    df500["_land_use_mapped"] = df500["Land_use"].map(LANDUSE_MAP).fillna("Agricultural")

    # Map ownership
    df500["_ownership_mapped"] = df500["Ownership"].apply(infer_ownership)

    # ---- Build empirical distributions from original dataset ----
    cat_cols = [c for c in cfg.CATEGORICAL_COLS if c not in ("Land Use", "Ownership")]
    target   = cfg.TARGET_COL

    rng = np.random.default_rng(seed=cfg.RANDOM_STATE)
    synthetic_rows = []

    for _, row500 in df500.iterrows():
        land_use  = row500["_land_use_mapped"]
        ownership = row500["_ownership_mapped"]

        # Sample from rows in original data that share the same land_use bucket
        pool = orig_df[orig_df["Land Use"] == land_use]
        if len(pool) < 3:
            pool = orig_df  # fall back to full dataset if bucket too small

        donor = pool.sample(n=1, random_state=int(rng.integers(0, 9999))).iloc[0]

        synth: dict = {
            # Display / identity columns from the source file
            "Land ID":  str(row500.get("Record_ID", "N/A")),
            "District": str(row500.get("District",  "N/A")),
            "Taluk":    str(row500.get("Taluk",     "N/A")),
            "Village":  str(row500.get("Village",   "N/A")),
            # ML feature columns
            "Area (sq.ft)":      max(500.0, float(donor["Area (sq.ft)"]) * rng.uniform(0.7, 1.4)),
            "Soil pH":           float(np.clip(donor["Soil pH"] + rng.normal(0, 0.3), 4.0, 9.0)),
            "No. of Owners":     max(1, int(donor["No. of Owners"] + rng.integers(-1, 2))),
            "No. of Objections": max(0, int(donor["No. of Objections"] + rng.integers(-1, 2))),
            "Valuation Gap (%)": float(np.clip(donor["Valuation Gap (%)"] + rng.normal(0, 5), 0, 60)),
            "Land Use":          land_use,
            "Ownership":         ownership,
        }

        # Fill remaining categorical columns by sampling from donor pool
        for col in cat_cols:
            synth[col] = donor[col]

        # Target: sample from original distribution within ±30% of donor's delay
        donor_delay = float(donor[target])
        synth[target] = float(np.clip(
            donor_delay * rng.uniform(0.7, 1.3), 0, 400
        ))

        synthetic_rows.append(synth)

    synth_df = pd.DataFrame(synthetic_rows)
    log.info("Synthesised %d rows from 500-record workbook", len(synth_df))
    return synth_df


# ===========================================================================
# 3. Parse TN project dataset → derive coarse delay estimate from status+dates
# ===========================================================================
def parse_tn_projects(orig_df: pd.DataFrame) -> pd.DataFrame:
    """
    The TN project dataset has project_start_date, expected_completion_date,
    and status. We can compute planned duration and use status to infer
    delay buckets, then synthesise full feature rows from the original dataset.
    Carries district and project_name as display columns.
    """
    df_tn = pd.read_excel(NEW_FILE_2)
    log.info("TN project dataset: %d rows", len(df_tn))

    rng = np.random.default_rng(seed=cfg.RANDOM_STATE + 1)

    # Parse dates
    df_tn["start"]    = pd.to_datetime(df_tn["project_start_date"],       errors="coerce")
    df_tn["end"]      = pd.to_datetime(df_tn["expected_completion_date"], errors="coerce")
    df_tn["duration"] = (df_tn["end"] - df_tn["start"]).dt.days.clip(0, 3000)

    # Map status → delay proxy
    STATUS_DELAY = {
        "Completed":   lambda d, r: max(0.0, float(r.uniform(0.05, 0.25)) * d),
        "In Progress": lambda d, r: float(r.uniform(0.3, 0.9)) * d,
        "Delayed":     lambda d, r: float(r.uniform(0.8, 1.5)) * d,
        "Stalled":     lambda d, r: float(r.uniform(1.2, 2.0)) * d,
    }

    synthetic_rows = []
    all_features = cfg.NUMERICAL_COLS + cfg.CATEGORICAL_COLS

    for _, row in df_tn.iterrows():
        duration   = row["duration"] if not pd.isna(row["duration"]) else 365
        status     = str(row["status"]).strip()
        delay_fn   = STATUS_DELAY.get(status, lambda d, r: float(r.uniform(0.3, 1.0)) * d)
        delay_days = float(np.clip(delay_fn(duration, rng), 0, 400))

        donor = orig_df.sample(n=1, random_state=int(rng.integers(0, 9999))).iloc[0]

        synth: dict = {
            # Display / identity columns from the TN source
            "Land ID":  f"TN-{row.get('project_id', 'N/A')}",
            "District": str(row.get("district",     "N/A")),
            "Taluk":    "N/A",
            "Village":  str(row.get("project_name", "N/A")),
        }
        # ML feature columns from donor
        synth.update({col: donor[col] for col in all_features})
        # Add some noise to numerical features
        synth["Area (sq.ft)"]      = max(500.0, float(synth["Area (sq.ft)"]) * rng.uniform(0.8, 1.3))
        synth["Valuation Gap (%)"] = float(np.clip(float(synth["Valuation Gap (%)"]) + rng.normal(0, 4), 0, 60))
        synth[cfg.TARGET_COL]      = delay_days

        synthetic_rows.append(synth)

    synth_df = pd.DataFrame(synthetic_rows)
    log.info("Synthesised %d rows from TN project dataset", len(synth_df))
    return synth_df


# ===========================================================================
# 4. Merge and save combined dataset
# ===========================================================================
def merge_and_save(orig_df: pd.DataFrame, synth_500: pd.DataFrame, synth_tn: pd.DataFrame) -> pd.DataFrame:
    ml_cols      = cfg.NUMERICAL_COLS + cfg.CATEGORICAL_COLS + [cfg.TARGET_COL]
    display_cols = ["Land ID", "District", "Taluk", "Village"]

    # ---- Original: carry its real display columns ----
    orig_subset = orig_df[ml_cols].copy()
    for col in display_cols:
        orig_subset[col] = orig_df[col] if col in orig_df.columns else "N/A"
    orig_subset["_source"] = "original"

    # ---- 500-record: display cols already in synth_500 ----
    synth_500_sub = synth_500[ml_cols + display_cols].copy()
    synth_500_sub["_source"] = "synth_500"

    # ---- TN projects: display cols already in synth_tn ----
    synth_tn_sub = synth_tn[ml_cols + display_cols].copy()
    synth_tn_sub["_source"] = "synth_tn"

    combined = pd.concat([orig_subset, synth_500_sub, synth_tn_sub], ignore_index=True)

    # Ensure correct dtypes for ML columns
    for col in cfg.NUMERICAL_COLS:
        combined[col] = pd.to_numeric(combined[col], errors="coerce")

    combined = combined.dropna(subset=cfg.NUMERICAL_COLS + [cfg.TARGET_COL])

    log.info("Combined dataset: %d rows (orig=%d + synth_500=%d + synth_tn=%d)",
             len(combined), len(orig_subset), len(synth_500_sub), len(synth_tn_sub))
    log.info("Target stats -- min=%.1f  max=%.1f  mean=%.1f  std=%.1f",
             combined[cfg.TARGET_COL].min(), combined[cfg.TARGET_COL].max(),
             combined[cfg.TARGET_COL].mean(), combined[cfg.TARGET_COL].std())

    # Save without the internal _source column
    combined.drop(columns=["_source"]).to_csv(MERGED_CSV, index=False)
    log.info("Merged dataset saved -> %s", MERGED_CSV)
    return combined


# ===========================================================================
# 5. Update config.json to point Prepare_data at the merged CSV
# ===========================================================================
def patch_config_for_merged() -> None:
    """
    Temporarily override the RAW_DATA_PATH by writing the merged CSV path
    into a small override file that Prepare_data.py will detect.
    """
    import json
    override = {"raw_data_override_csv": str(MERGED_CSV)}
    override_path = MODELS_DIR / "data_override.json"
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    with open(override_path, "w") as f:
        json.dump(override, f)
    log.info("Data override written -> %s", override_path)


# ===========================================================================
# 6. Run Prepare_data and Train_model via subprocess
# ===========================================================================
def run_phase(script: str) -> None:
    src_dir = Path(__file__).resolve().parent
    result = subprocess.run(
        [sys.executable, str(src_dir / script)],
        cwd=str(src_dir.parent),
        capture_output=False,
    )
    if result.returncode != 0:
        log.error("Script %s exited with code %d", script, result.returncode)
        sys.exit(result.returncode)
    log.info("Script %s completed successfully", script)


# ===========================================================================
# Main
# ===========================================================================
def main() -> None:
    log.info("=" * 68)
    log.info("ACQUISIGHT -- Data Augmentation + Retrain")
    log.info("=" * 68)

    orig_df   = load_original()
    synth_500 = parse_new_500(orig_df)
    synth_tn  = parse_tn_projects(orig_df)
    combined  = merge_and_save(orig_df, synth_500, synth_tn)

    log.info("=" * 68)
    log.info("Starting Phase 2: Prepare_data.py")
    log.info("=" * 68)
    run_phase("Prepare_data_merged.py")

    log.info("=" * 68)
    log.info("Starting Phase 3: Train_model.py")
    log.info("=" * 68)
    run_phase("Train_model.py")

    log.info("=" * 68)
    log.info("All done! New pipeline trained on %d rows.", len(combined))
    log.info("=" * 68)


if __name__ == "__main__":
    main()
