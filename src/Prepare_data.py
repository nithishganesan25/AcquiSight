"""
Prepare_data.py
===============
Clean the official gazette land records and write train/test CSVs
plus a fitted preprocessor. Training happens in Train_model.py.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder, StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_config import MODELS_DIR, cfg, export_api_config  # noqa: E402
from prepare_real_data import prepare  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format=cfg.LOG_FORMAT,
    datefmt=cfg.LOG_DATE_FORMAT,
    handlers=[
        logging.StreamHandler(open(sys.stdout.fileno(), mode="w", encoding="utf-8", closefd=False))
    ],
)
log = logging.getLogger("prepare_data")


def build_preprocessor() -> ColumnTransformer:
    numeric_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    categorical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            (
                "encoder",
                OrdinalEncoder(
                    handle_unknown="use_encoded_value",
                    unknown_value=-1,
                    dtype=np.float64,
                ),
            ),
        ]
    )
    return ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, cfg.NUMERICAL_COLS),
            ("cat", categorical_transformer, cfg.CATEGORICAL_COLS),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )


def split_and_save(df: pd.DataFrame):
    feature_cols = cfg.NUMERICAL_COLS + cfg.CATEGORICAL_COLS
    missing_feats = [c for c in feature_cols + [cfg.TARGET_COL, cfg.CLASS_TARGET_COL] if c not in df.columns]
    if missing_feats:
        raise ValueError(f"Cleaned data missing columns: {missing_feats}")

    # Stratify by recorded Delay_Status so both classes appear in test
    strata = df[cfg.CLASS_TARGET_COL].astype(str)
    can_stratify = (strata.value_counts() >= 2).all()

    train_df, test_df = train_test_split(
        df,
        test_size=cfg.TEST_SIZE,
        random_state=cfg.RANDOM_STATE,
        stratify=strata if can_stratify else None,
    )

    keep = feature_cols + [cfg.TARGET_COL, cfg.CLASS_TARGET_COL, "Land_ID", "Taluk", "Village", "Survey_No", "Delay_Risk_Band"]
    keep = [c for c in keep if c in df.columns]
    train_df[keep].to_csv(cfg.TRAIN_CSV, index=False)
    test_df[keep].to_csv(cfg.TEST_CSV, index=False)
    log.info("Train/test split: %d / %d", len(train_df), len(test_df))

    preprocessor = build_preprocessor()
    preprocessor.fit(train_df[feature_cols])
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(preprocessor, MODELS_DIR / "preprocessor.pkl")
    export_api_config()
    log.info("Saved preprocessor and config")
    return train_df, test_df, preprocessor


def main() -> None:
    log.info("=" * 68)
    log.info("ACQUISIGHT — real-data preparation")
    log.info("=" * 68)
    cleaned = prepare()
    split_and_save(cleaned)
    log.info("Next -> python src/Train_model.py")


if __name__ == "__main__":
    main()
