"""
model_config.py
===============
Single source of truth for ACQUISIGHT ML pipeline configuration.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List

_SRC_DIR = Path(__file__).resolve().parent
_ROOT = _SRC_DIR.parent
DATA_DIR = _ROOT / "data"
MODELS_DIR = _ROOT / "models"


@dataclass(frozen=True)
class Config:
    RAW_DATA_PATH: Path = DATA_DIR / "land acquisition_01.xlsx"
    CLEANED_CSV: Path = DATA_DIR / "cleaned_land_records.csv"
    SCORED_CSV: Path = DATA_DIR / "land_records_scored.csv"
    TRAIN_CSV: Path = DATA_DIR / "train_processed.csv"
    TEST_CSV: Path = DATA_DIR / "test_processed.csv"
    CATEGORIES_JSON: Path = DATA_DIR / "feature_categories.json"

    PIPELINE_PATH: Path = MODELS_DIR / "delay_regression_pipeline.pkl"
    CLASSIFIER_PATH: Path = MODELS_DIR / "risk_classification_pipeline.pkl"
    LEGACY_PIPELINE_PATH: Path = MODELS_DIR / "acquisight_pipeline.pkl"
    METADATA_PATH: Path = MODELS_DIR / "model_metadata.json"
    IMPORTANCE_CSV: Path = MODELS_DIR / "feature_importance.csv"
    CONFIG_JSON: Path = MODELS_DIR / "config.json"

    NUMERICAL_COLS: List[str] = field(
        default_factory=lambda: [
            "Area_Sqft",
            "Soil_pH",
            "No_of_Owners",
        ]
    )

    CATEGORICAL_COLS: List[str] = field(
        default_factory=lambda: [
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
    )

    TARGET_COL: str = "Acquisition_Days"
    CLASS_TARGET_COL: str = "Delay_Status"

    RISK_THRESHOLDS: Dict[str, Dict[str, int]] = field(
        default_factory=lambda: {
            "Low": {"min": 0, "max": 60},
            "Medium": {"min": 61, "max": 120},
            "High": {"min": 121, "max": 9999},
        }
    )

    TEST_SIZE: float = 0.2
    RANDOM_STATE: int = 42
    CV_FOLDS: int = 5
    SEARCH_N_ITER: int = 16

    RF_PARAM_GRID: Dict = field(
        default_factory=lambda: {
            "model__n_estimators": [150, 250, 400],
            "model__max_depth": [4, 6, 10, None],
            "model__min_samples_split": [2, 5, 10],
            "model__min_samples_leaf": [1, 2, 4],
            "model__max_features": ["sqrt", "log2"],
        }
    )
    GB_PARAM_GRID: Dict = field(
        default_factory=lambda: {
            "model__n_estimators": [100, 200],
            "model__learning_rate": [0.05, 0.1, 0.2],
            "model__max_depth": [2, 3, 4],
            "model__subsample": [0.8, 1.0],
        }
    )
    ET_PARAM_GRID: Dict = field(
        default_factory=lambda: {
            "model__n_estimators": [150, 250, 400],
            "model__max_depth": [4, 6, 10, None],
            "model__min_samples_split": [2, 5, 10],
            "model__min_samples_leaf": [1, 2, 4],
        }
    )
    HGB_PARAM_GRID: Dict = field(
        default_factory=lambda: {
            "model__max_depth": [3, 6, None],
            "model__learning_rate": [0.05, 0.1, 0.2],
            "model__max_iter": [150, 300],
            "model__min_samples_leaf": [10, 20],
        }
    )
    CLF_RF_GRID: Dict = field(
        default_factory=lambda: {
            "model__n_estimators": [150, 300],
            "model__max_depth": [4, 8, None],
            "model__min_samples_split": [2, 5],
            "model__class_weight": ["balanced", None],
        }
    )

    LOG_FORMAT: str = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
    LOG_DATE_FORMAT: str = "%Y-%m-%d %H:%M:%S"


cfg = Config()


def export_api_config(extra: dict | None = None) -> None:
    payload = {
        "feature_columns": cfg.NUMERICAL_COLS + cfg.CATEGORICAL_COLS,
        "numerical_cols": cfg.NUMERICAL_COLS,
        "categorical_cols": cfg.CATEGORICAL_COLS,
        "target_column": cfg.TARGET_COL,
        "classification_target": cfg.CLASS_TARGET_COL,
        "risk_thresholds": cfg.RISK_THRESHOLDS,
        "pipeline_path": str(cfg.PIPELINE_PATH),
        "classifier_path": str(cfg.CLASSIFIER_PATH),
        "cleaned_csv": str(cfg.CLEANED_CSV),
        "scored_csv": str(cfg.SCORED_CSV),
        "notes": {
            "risk_category": "Derived from predicted Acquisition_Days using risk_thresholds. Delay_Status is the recorded binary label.",
            "excluded_features": ["Land_ID", "Survey_No", "Taluk", "Village", "Ownership_Raw"],
        },
    }
    if extra:
        payload.update(extra)
    cfg.CONFIG_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(cfg.CONFIG_JSON, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)


if __name__ == "__main__":
    import logging

    logging.basicConfig(level=logging.INFO, format=cfg.LOG_FORMAT, datefmt=cfg.LOG_DATE_FORMAT)
    log = logging.getLogger(__name__)
    log.info("RAW_DATA_PATH : %s", cfg.RAW_DATA_PATH)
    log.info("CLEANED_CSV   : %s", cfg.CLEANED_CSV)
    log.info("Numerical     : %s", cfg.NUMERICAL_COLS)
    log.info("Categorical   : %s", cfg.CATEGORICAL_COLS)
    log.info("Targets       : %s / %s", cfg.TARGET_COL, cfg.CLASS_TARGET_COL)
