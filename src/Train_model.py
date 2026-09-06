"""
Train_model.py
==============
Train delay-days regression and delay-status classification pipelines
on the cleaned official gazette land records.
"""

from __future__ import annotations

import json
import logging
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import (
    ExtraTreesClassifier,
    ExtraTreesRegressor,
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    HistGradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
)
from sklearn.model_selection import KFold, RandomizedSearchCV, StratifiedKFold, cross_validate
from sklearn.pipeline import Pipeline

sys.path.insert(0, str(Path(__file__).resolve().parent))
from model_config import MODELS_DIR, cfg, export_api_config  # noqa: E402
from Prepare_data import split_and_save  # noqa: E402
from gis_utils import attach_approx_coords  # noqa: E402
from prepare_real_data import CLEANED_CSV, prepare  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format=cfg.LOG_FORMAT,
    datefmt=cfg.LOG_DATE_FORMAT,
    handlers=[
        logging.StreamHandler(open(sys.stdout.fileno(), mode="w", encoding="utf-8", closefd=False))
    ],
)
log = logging.getLogger("train_model")
warnings.filterwarnings("ignore", category=UserWarning)


def _metrics_reg(y_true, y_pred) -> Dict[str, float]:
    return {
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 4),
        "r2": round(float(r2_score(y_true, y_pred)), 4),
    }


def _metrics_clf(y_true, y_pred) -> Dict[str, Any]:
    labels = sorted(pd.unique(y_true))
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision_macro": round(float(precision_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "recall_macro": round(float(recall_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "f1_macro": round(float(f1_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "labels": [str(x) for x in labels],
        "confusion_matrix": cm.tolist(),
    }


def _days_to_band(days: float) -> str:
    if days <= cfg.RISK_THRESHOLDS["Low"]["max"]:
        return "Low"
    if days <= cfg.RISK_THRESHOLDS["Medium"]["max"]:
        return "Medium"
    return "High"


def _clone_preprocessor():
    path = MODELS_DIR / "preprocessor.pkl"
    return joblib.load(path)


def train_regressor(X_train, y_train, X_test, y_test, preprocessor) -> Tuple[str, Pipeline, Dict, Dict]:
    candidates = {
        "RandomForest": (
            Pipeline([("preprocessor", preprocessor), ("model", RandomForestRegressor(random_state=cfg.RANDOM_STATE, n_jobs=1))]),
            cfg.RF_PARAM_GRID,
        ),
        "GradientBoosting": (
            Pipeline([("preprocessor", preprocessor), ("model", GradientBoostingRegressor(random_state=cfg.RANDOM_STATE))]),
            cfg.GB_PARAM_GRID,
        ),
        "ExtraTrees": (
            Pipeline([("preprocessor", preprocessor), ("model", ExtraTreesRegressor(random_state=cfg.RANDOM_STATE, n_jobs=1))]),
            cfg.ET_PARAM_GRID,
        ),
        "HistGradientBoosting": (
            Pipeline(
                [
                    ("preprocessor", preprocessor),
                    ("model", HistGradientBoostingRegressor(random_state=cfg.RANDOM_STATE)),
                ]
            ),
            cfg.HGB_PARAM_GRID,
        ),
    }

    kf = KFold(n_splits=cfg.CV_FOLDS, shuffle=True, random_state=cfg.RANDOM_STATE)
    cv_results = {}
    log.info("Regression baseline CV")
    for name, (pipe, _) in candidates.items():
        scores = cross_validate(
            pipe,
            X_train,
            y_train,
            cv=kf,
            scoring=["neg_mean_absolute_error", "neg_root_mean_squared_error", "r2"],
            n_jobs=1,
        )
        cv_results[name] = {
            "cv_mae": round(float(-scores["test_neg_mean_absolute_error"].mean()), 2),
            "cv_rmse": round(float(-scores["test_neg_root_mean_squared_error"].mean()), 2),
            "cv_r2": round(float(scores["test_r2"].mean()), 4),
        }
        log.info("  %-22s MAE=%.2f  RMSE=%.2f  R2=%.3f", name, cv_results[name]["cv_mae"], cv_results[name]["cv_rmse"], cv_results[name]["cv_r2"])

    best_name = min(cv_results, key=lambda n: cv_results[n]["cv_mae"])
    log.info("Tuning regressor: %s", best_name)
    pipe, grid = candidates[best_name]
    search = RandomizedSearchCV(
        pipe,
        grid,
        n_iter=cfg.SEARCH_N_ITER,
        scoring="neg_mean_absolute_error",
        cv=kf,
        n_jobs=1,
        random_state=cfg.RANDOM_STATE,
        refit=True,
    )
    search.fit(X_train, y_train)
    best = search.best_estimator_
    y_tr = np.clip(best.predict(X_train), 0, None)
    y_te = np.clip(best.predict(X_test), 0, None)
    eval_results = {"train": _metrics_reg(y_train, y_tr), "test": _metrics_reg(y_test, y_te)}
    log.info("REG TRAIN %s", eval_results["train"])
    log.info("REG TEST  %s", eval_results["test"])
    return best_name, best, search.best_params_, {"cv": cv_results, "final": eval_results}


def train_classifier(X_train, y_train, X_test, y_test, preprocessor) -> Tuple[str, Pipeline, Dict, Dict]:
    candidates = {
        "RandomForest": (
            Pipeline(
                [
                    ("preprocessor", preprocessor),
                    ("model", RandomForestClassifier(random_state=cfg.RANDOM_STATE, n_jobs=1)),
                ]
            ),
            cfg.CLF_RF_GRID,
        ),
        "ExtraTrees": (
            Pipeline(
                [
                    ("preprocessor", preprocessor),
                    ("model", ExtraTreesClassifier(random_state=cfg.RANDOM_STATE, n_jobs=1)),
                ]
            ),
            cfg.CLF_RF_GRID,
        ),
        "GradientBoosting": (
            Pipeline(
                [
                    ("preprocessor", preprocessor),
                    ("model", GradientBoostingClassifier(random_state=cfg.RANDOM_STATE)),
                ]
            ),
            {
                "model__n_estimators": [100, 200],
                "model__learning_rate": [0.05, 0.1],
                "model__max_depth": [2, 3],
            },
        ),
        "LogisticRegression": (
            Pipeline(
                [
                    ("preprocessor", preprocessor),
                    (
                        "model",
                        LogisticRegression(max_iter=2000, class_weight="balanced", random_state=cfg.RANDOM_STATE),
                    ),
                ]
            ),
            {"model__C": [0.25, 1.0, 4.0]},
        ),
    }
    skf = StratifiedKFold(n_splits=cfg.CV_FOLDS, shuffle=True, random_state=cfg.RANDOM_STATE)
    cv_results = {}
    log.info("Classification baseline CV")
    for name, (pipe, _) in candidates.items():
        scores = cross_validate(pipe, X_train, y_train, cv=skf, scoring=["accuracy", "f1_macro"], n_jobs=1)
        cv_results[name] = {
            "cv_accuracy": round(float(scores["test_accuracy"].mean()), 4),
            "cv_f1_macro": round(float(scores["test_f1_macro"].mean()), 4),
        }
        log.info("  %-22s acc=%.3f  f1=%.3f", name, cv_results[name]["cv_accuracy"], cv_results[name]["cv_f1_macro"])

    best_name = max(cv_results, key=lambda n: cv_results[n]["cv_f1_macro"])
    log.info("Tuning classifier: %s", best_name)
    pipe, grid = candidates[best_name]
    search = RandomizedSearchCV(
        pipe,
        grid,
        n_iter=min(cfg.SEARCH_N_ITER, 12),
        scoring="f1_macro",
        cv=skf,
        n_jobs=1,
        random_state=cfg.RANDOM_STATE,
        refit=True,
    )
    search.fit(X_train, y_train)
    best = search.best_estimator_
    eval_results = {
        "train": _metrics_clf(y_train, best.predict(X_train)),
        "test": _metrics_clf(y_test, best.predict(X_test)),
    }
    log.info("CLF TRAIN acc=%s f1=%s", eval_results["train"]["accuracy"], eval_results["train"]["f1_macro"])
    log.info("CLF TEST  acc=%s f1=%s", eval_results["test"]["accuracy"], eval_results["test"]["f1_macro"])
    log.info("CLF TEST confusion %s labels=%s", eval_results["test"]["confusion_matrix"], eval_results["test"]["labels"])
    return best_name, best, search.best_params_, {"cv": cv_results, "final": eval_results}


def extract_importance(pipeline: Pipeline) -> pd.DataFrame:
    model = pipeline.named_steps["model"]
    names = cfg.NUMERICAL_COLS + cfg.CATEGORICAL_COLS
    if not hasattr(model, "feature_importances_"):
        log.warning("Winning model has no feature_importances_")
        return pd.DataFrame(columns=["feature", "importance"])
    values = np.array(model.feature_importances_, dtype=float)
    n = min(len(names), len(values))
    df = (
        pd.DataFrame({"feature": names[:n], "importance": values[:n]})
        .sort_values("importance", ascending=False)
        .reset_index(drop=True)
    )
    df.to_csv(cfg.IMPORTANCE_CSV, index=False)
    log.info("Feature importance saved -> %s", cfg.IMPORTANCE_CSV)
    for _, row in df.head(10).iterrows():
        log.info("  %-24s %.4f", row["feature"], row["importance"])
    return df


def score_all_records(reg_pipe: Pipeline, clf_pipe: Pipeline, df: pd.DataFrame) -> pd.DataFrame:
    feats = cfg.NUMERICAL_COLS + cfg.CATEGORICAL_COLS
    scored = df.copy()
    scored["Predicted_Delay_Days"] = np.clip(reg_pipe.predict(df[feats]), 0, None).round(1)
    scored["Predicted_Delay_Status"] = clf_pipe.predict(df[feats])
    scored["Predicted_Risk_Category"] = scored["Predicted_Delay_Days"].map(_days_to_band)
    if hasattr(clf_pipe, "predict_proba"):
        proba = clf_pipe.predict_proba(df[feats])
        classes = list(clf_pipe.classes_) if hasattr(clf_pipe, "classes_") else list(clf_pipe.named_steps["model"].classes_)
        delayed_idx = classes.index("Delayed") if "Delayed" in classes else 0
        scored["Predicted_Delay_Probability"] = proba[:, delayed_idx].round(4)
    else:
        scored["Predicted_Delay_Probability"] = np.nan
    scored = attach_approx_coords(scored)
    scored.to_csv(cfg.SCORED_CSV, index=False)
    log.info("Scored land records -> %s", cfg.SCORED_CSV)
    return scored


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    log.info("=" * 68)
    log.info("ACQUISIGHT — train real-data models")
    log.info("=" * 68)
    log.info("Dataset is 500 gazette parcels. Metrics are prototype estimates, not production accuracy.")

    if CLEANED_CSV.exists():
        cleaned = pd.read_csv(CLEANED_CSV)
    else:
        cleaned = prepare()

    train_df, test_df, preprocessor = split_and_save(cleaned)
    feats = cfg.NUMERICAL_COLS + cfg.CATEGORICAL_COLS
    X_train, X_test = train_df[feats], test_df[feats]
    y_reg_tr, y_reg_te = train_df[cfg.TARGET_COL], test_df[cfg.TARGET_COL]
    y_clf_tr, y_clf_te = train_df[cfg.CLASS_TARGET_COL], test_df[cfg.CLASS_TARGET_COL]

    # Leakage guard: targets are not in feature list
    assert cfg.TARGET_COL not in feats
    assert cfg.CLASS_TARGET_COL not in feats
    assert "Land_ID" not in feats and "Survey_No" not in feats

    reg_name, reg_pipe, reg_params, reg_eval = train_regressor(
        X_train, y_reg_tr, X_test, y_reg_te, preprocessor
    )
    clf_pre = _clone_preprocessor()
    clf_name, clf_pipe, clf_params, clf_eval = train_classifier(
        X_train, y_clf_tr, X_test, y_clf_te, clf_pre
    )

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(reg_pipe, cfg.PIPELINE_PATH)
    joblib.dump(clf_pipe, cfg.CLASSIFIER_PATH)
    joblib.dump(reg_pipe, cfg.LEGACY_PIPELINE_PATH)
    extract_importance(reg_pipe)
    score_all_records(reg_pipe, clf_pipe, cleaned)

    metadata = {
        "trained_at": datetime.now(tz=timezone.utc).isoformat(),
        "dataset": {
            "source": "land acquisition_01.xlsx",
            "cleaned_rows": int(len(cleaned)),
            "train_rows": int(len(train_df)),
            "test_rows": int(len(test_df)),
            "note": "Small gazette-derived prototype set. Do not treat test metrics as real-world production performance.",
        },
        "feature_columns": feats,
        "excluded_from_features": ["Land_ID", "Survey_No", "Taluk", "Village", "Ownership_Raw", "Acquisition_Days", "Delay_Status"],
        "regression": {
            "target": cfg.TARGET_COL,
            "winning_model": reg_name,
            "best_params": reg_params,
            "metrics": reg_eval,
        },
        "classification": {
            "target": cfg.CLASS_TARGET_COL,
            "winning_model": clf_name,
            "best_params": clf_params,
            "metrics": clf_eval,
            "classes": ["No Delay", "Delayed"],
        },
        "risk_thresholds": cfg.RISK_THRESHOLDS,
        "winning_model": reg_name,
        "final_metrics": reg_eval["final"],
        "best_params": reg_params,
    }
    with open(cfg.METADATA_PATH, "w", encoding="utf-8") as fh:
        json.dump(metadata, fh, indent=2, default=str)
    export_api_config({"winning_regressor": reg_name, "winning_classifier": clf_name})
    log.info("Saved %s", cfg.PIPELINE_PATH)
    log.info("Saved %s", cfg.CLASSIFIER_PATH)
    log.info("Saved %s", cfg.METADATA_PATH)


if __name__ == "__main__":
    main()
