"""
Prepare_data_merged.py
======================
ACQUISIGHT — Phase 2 (Merged Dataset variant)

Same logic as Prepare_data.py but reads from the merged_dataset.csv
produced by augment_and_train.py instead of the raw Excel file.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder, StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_config import cfg, export_api_config, MODELS_DIR  # noqa: E402

# ---------------------------------------------------------------------------
# Logging  (force UTF-8 so Unicode chars render on Windows terminals)
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
log = logging.getLogger("prepare_data_merged")

MERGED_CSV = cfg.TRAIN_CSV.parent / "merged_dataset.csv"


# ===========================================================================
# Load & validate
# ===========================================================================
def load_data(path: Path) -> pd.DataFrame:
    log.info("Loading merged dataset from: %s", path)
    df = pd.read_csv(path)
    log.info("  Rows loaded      : %d", len(df))
    log.info("  Columns detected : %d", len(df.columns))

    required = cfg.NUMERICAL_COLS + cfg.CATEGORICAL_COLS + [cfg.TARGET_COL]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    log.info("  Schema validated [OK]")
    return df


def report_data_quality(df: pd.DataFrame) -> None:
    log.info("--- Data Quality Report ---")
    missing = df.isnull().sum()
    missing = missing[missing > 0]
    if missing.empty:
        log.info("  Missing values : none [OK]")
    else:
        log.warning("  Missing values:\n%s", missing.to_string())

    n_dup = df.duplicated().sum()
    log.info("  Duplicate rows : %d", n_dup)

    t = df[cfg.TARGET_COL]
    log.info(
        "  Target (%s): min=%.1f  max=%.1f  mean=%.1f  std=%.1f",
        cfg.TARGET_COL, t.min(), t.max(), t.mean(), t.std(),
    )

    risk_dist = t.apply(
        lambda d: "Low" if d <= 60 else ("Medium" if d <= 150 else "High")
    ).value_counts()
    log.info("  Risk distribution:\n%s", risk_dist.to_string())


# ===========================================================================
# Build preprocessor
# ===========================================================================
def build_preprocessor() -> ColumnTransformer:
    numeric_transformer = Pipeline([("scaler", StandardScaler())])
    categorical_transformer = Pipeline([
        ("encoder", OrdinalEncoder(
            handle_unknown="use_encoded_value",
            unknown_value=-1,
            dtype=np.float64,
        ))
    ])
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, cfg.NUMERICAL_COLS),
            ("cat", categorical_transformer, cfg.CATEGORICAL_COLS),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )
    log.info("Preprocessor built: %d numeric + %d categorical features",
             len(cfg.NUMERICAL_COLS), len(cfg.CATEGORICAL_COLS))
    return preprocessor


# ===========================================================================
# Train-test split
# ===========================================================================
def split_data(df: pd.DataFrame):
    def days_to_risk(d: float) -> str:
        if d <= cfg.RISK_THRESHOLDS["Low"]["max"]:    return "Low"
        if d <= cfg.RISK_THRESHOLDS["Medium"]["max"]: return "Medium"
        return "High"

    risk_strata = df[cfg.TARGET_COL].apply(days_to_risk)
    can_stratify = (risk_strata.value_counts() >= 2).all()
    if not can_stratify:
        log.warning("Some risk classes have <2 samples; using random split.")

    all_feature_cols = cfg.NUMERICAL_COLS + cfg.CATEGORICAL_COLS
    X = df[all_feature_cols]
    y = df[cfg.TARGET_COL]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=cfg.TEST_SIZE,
        random_state=cfg.RANDOM_STATE,
        stratify=risk_strata if can_stratify else None,
    )
    log.info("Train/test split: %d train / %d test", len(X_train), len(X_test))
    return X_train, X_test, y_train, y_test


# ===========================================================================
# Fit & save
# ===========================================================================
def fit_and_save(X_train, X_test, y_train, y_test) -> ColumnTransformer:
    preprocessor = build_preprocessor()
    preprocessor.fit(X_train)
    log.info("  Preprocessor fitted [OK]")

    cfg.TRAIN_CSV.parent.mkdir(parents=True, exist_ok=True)
    pd.concat([X_train, y_train], axis=1).to_csv(cfg.TRAIN_CSV, index=False)
    pd.concat([X_test,  y_test],  axis=1).to_csv(cfg.TEST_CSV,  index=False)
    log.info("  Saved train CSV -> %s", cfg.TRAIN_CSV)
    log.info("  Saved test  CSV -> %s", cfg.TEST_CSV)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    preprocessor_path = MODELS_DIR / "preprocessor.pkl"
    joblib.dump(preprocessor, preprocessor_path)
    log.info("  Saved preprocessor -> %s", preprocessor_path)

    export_api_config()
    log.info("  Updated config.json -> %s", cfg.CONFIG_JSON)
    return preprocessor


# ===========================================================================
# Main
# ===========================================================================
def main() -> None:
    log.info("=" * 68)
    log.info("ACQUISIGHT -- Phase 2: Data Preparation (Merged Dataset)")
    log.info("=" * 68)

    df = load_data(MERGED_CSV)
    report_data_quality(df)

    X_train, X_test, y_train, y_test = split_data(df)
    fit_and_save(X_train, X_test, y_train, y_test)

    log.info("=" * 68)
    log.info("Phase 2 complete. Next -> python Train_model.py")
    log.info("=" * 68)


if __name__ == "__main__":
    main()
