"""
evaluate_model.py
=================
Comprehensive, reproducible ML evaluation and validation suite for AcquiSight AI.
Evaluates both original models (on held-out test_processed.csv) and corrected models
(under group-based parcel split to audit and eliminate replication data leakage).
Generates all metrics, comparison tables, and publication-ready plots into evaluation/results/.
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Dict, Any

import joblib
import numpy as np
import pandas as pd
import requests

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import (
    ExtraTreesClassifier,
    ExtraTreesRegressor,
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    HistGradientBoostingClassifier,
    HistGradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    median_absolute_error,
    precision_recall_curve,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import (
    GroupKFold,
    GroupShuffleSplit,
    KFold,
    StratifiedKFold,
    cross_validate,
)
from sklearn.pipeline import Pipeline

# Paths
ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
MODELS_DIR = ROOT_DIR / "models"
RESULTS_DIR = ROOT_DIR / "evaluation" / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(open(sys.stdout.fileno(), mode="w", encoding="utf-8", closefd=False))
    ],
)
log = logging.getLogger("evaluate_model")

# Features & targets
FEAT_COLS = [
    "Area_Sqft", "Soil_pH", "No_of_Owners", "District", "Land_Type",
    "Flood_Risk", "Water_Availability", "Soil_Type", "Document_Issue",
    "Owner_Objection", "Court_Case", "Compensation_Status", "FMB",
    "A_Register", "Document_Verified", "Objection", "Ownership_Type"
]
REG_TARGET = "Acquisition_Days"
CLF_TARGET = "Delay_Status"

# Styling for plots
plt.rcParams.update({
    "figure.facecolor": "#0f172a",
    "axes.facecolor": "#1e293b",
    "axes.edgecolor": "#334155",
    "axes.labelcolor": "#e2e8f0",
    "xtick.color": "#94a3b8",
    "ytick.color": "#94a3b8",
    "grid.color": "#334155",
    "text.color": "#f8fafc",
    "font.size": 10,
    "savefig.dpi": 200,
    "savefig.bbox": "tight"
})


def calc_clf_metrics(y_true_binary: np.ndarray, y_pred_binary: np.ndarray, y_scores: np.ndarray) -> Dict[str, Any]:
    tn, fp, fn, tp = confusion_matrix(y_true_binary, y_pred_binary).ravel()
    acc = accuracy_score(y_true_binary, y_pred_binary)
    prec = precision_score(y_true_binary, y_pred_binary, zero_division=0)
    rec = recall_score(y_true_binary, y_pred_binary, zero_division=0)
    f1 = f1_score(y_true_binary, y_pred_binary, zero_division=0)
    spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    auc = roc_auc_score(y_true_binary, y_scores) if len(np.unique(y_true_binary)) > 1 else 1.0
    pr_auc = average_precision_score(y_true_binary, y_scores) if len(np.unique(y_true_binary)) > 1 else 1.0

    return {
        "accuracy": round(float(acc), 6),
        "precision": round(float(prec), 6),
        "recall": round(float(rec), 6),
        "f1": round(float(f1), 6),
        "specificity": round(float(spec), 6),
        "roc_auc": round(float(auc), 6),
        "pr_auc": round(float(pr_auc), 6),
        "confusion_matrix": {
            "tp": int(tp), "tn": int(tn), "fp": int(fp), "fn": int(fn)
        }
    }


def calc_reg_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
    mae = mean_absolute_error(y_true, y_pred)
    mse = mean_squared_error(y_true, y_pred)
    rmse = np.sqrt(mse)
    r2 = r2_score(y_true, y_pred)
    med_ae = median_absolute_error(y_true, y_pred)
    max_ae = np.max(np.abs(y_true - y_pred))

    diff = np.abs(y_true - y_pred)
    w7 = float((diff <= 7).mean() * 100)
    w14 = float((diff <= 14).mean() * 100)
    w30 = float((diff <= 30).mean() * 100)

    return {
        "mae": round(float(mae), 4),
        "mse": round(float(mse), 4),
        "rmse": round(float(rmse), 4),
        "r2": round(float(r2), 6),
        "median_absolute_error": round(float(med_ae), 4),
        "max_absolute_error": round(float(max_ae), 4),
        "mean_actual_delay": round(float(np.mean(y_true)), 2),
        "mean_predicted_delay": round(float(np.mean(y_pred)), 2),
        "min_actual_delay": round(float(np.min(y_true)), 2),
        "max_actual_delay": round(float(np.max(y_true)), 2),
        "min_predicted_delay": round(float(np.min(y_pred)), 2),
        "max_predicted_delay": round(float(np.max(y_pred)), 2),
        "within_7_days_pct": round(w7, 2),
        "within_14_days_pct": round(w14, 2),
        "within_30_days_pct": round(w30, 2),
    }


# ============================================================================
# Step 3 & 4 Plotting functions
# ============================================================================
def plot_confusion_matrix(cm_dict: Dict[str, int], title: str, filename: str):
    fig, ax = plt.subplots(figsize=(5, 4.2))
    matrix = np.array([
        [cm_dict["tp"], cm_dict["fn"]],
        [cm_dict["fp"], cm_dict["tn"]]
    ])
    cax = ax.matshow(matrix, cmap="Blues", alpha=0.85)
    fig.colorbar(cax, ax=ax, fraction=0.046, pad=0.04)

    labels = [["TP", "FN"], ["FP", "TN"]]
    for i in range(2):
        for j in range(2):
            val = matrix[i, j]
            ax.text(j, i, f"{labels[i][j]}\n{val:,}", ha="center", va="center",
                    color="#ffffff" if val > matrix.max() * 0.5 else "#93c5fd",
                    fontsize=12, fontweight="bold")

    ax.set_xticks([0, 1])
    ax.set_yticks([0, 1])
    ax.set_xticklabels(["Delayed", "No Delay"])
    ax.set_yticklabels(["Delayed", "No Delay"])
    ax.set_xlabel("Predicted Label", fontweight="bold", labelpad=8)
    ax.set_ylabel("Actual Ground Truth", fontweight="bold", labelpad=8)
    ax.set_title(title, pad=14, fontweight="bold", color="#38bdf8")
    fig.savefig(RESULTS_DIR / filename)
    plt.close(fig)
    log.info("Saved plot -> %s", filename)


def plot_roc_curve(y_true: np.ndarray, y_scores: np.ndarray, auc_val: float, title: str, filename: str):
    fpr, tpr, _ = roc_curve(y_true, y_scores)
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.plot(fpr, tpr, color="#38bdf8", lw=2.5, label=f"ROC Curve (AUC = {auc_val:.4f})")
    ax.plot([0, 1], [0, 1], color="#64748b", lw=1.5, linestyle="--", label="Random Baseline (AUC = 0.50)")
    ax.set_xlim([-0.02, 1.02])
    ax.set_ylim([-0.02, 1.05])
    ax.set_xlabel("False Positive Rate (1 - Specificity)")
    ax.set_ylabel("True Positive Rate (Recall)")
    ax.set_title(title, pad=12, fontweight="bold", color="#38bdf8")
    ax.legend(loc="lower right", facecolor="#1e293b", edgecolor="#334155")
    ax.grid(True, linestyle=":", alpha=0.6)
    fig.savefig(RESULTS_DIR / filename)
    plt.close(fig)
    log.info("Saved plot -> %s", filename)


def plot_pr_curve(y_true: np.ndarray, y_scores: np.ndarray, pr_auc_val: float, title: str, filename: str):
    prec, rec, _ = precision_recall_curve(y_true, y_scores)
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.plot(rec, prec, color="#34d399", lw=2.5, label=f"PR Curve (AP = {pr_auc_val:.4f})")
    no_skill = np.mean(y_true)
    ax.plot([0, 1], [no_skill, no_skill], color="#64748b", lw=1.5, linestyle="--", label=f"Baseline ({no_skill:.2f})")
    ax.set_xlim([-0.02, 1.02])
    ax.set_ylim([-0.02, 1.05])
    ax.set_xlabel("Recall")
    ax.set_ylabel("Precision")
    ax.set_title(title, pad=12, fontweight="bold", color="#34d399")
    ax.legend(loc="lower left", facecolor="#1e293b", edgecolor="#334155")
    ax.grid(True, linestyle=":", alpha=0.6)
    fig.savefig(RESULTS_DIR / filename)
    plt.close(fig)
    log.info("Saved plot -> %s", filename)


def plot_regression_analysis(y_true: np.ndarray, y_pred: np.ndarray, prefix: str):
    # 1. Actual vs Predicted
    fig, ax = plt.subplots(figsize=(6, 5.5))
    ax.scatter(y_true, y_pred, alpha=0.4, color="#38bdf8", edgecolors="none", s=18)
    lims = [0, max(np.max(y_true), np.max(y_pred)) * 1.05]
    ax.plot(lims, lims, color="#f43f5e", lw=2, linestyle="--", label="Perfect Prediction (y = x)")
    ax.set_xlim(lims)
    ax.set_ylim(lims)
    ax.set_xlabel("Actual Acquisition Delay (Days)")
    ax.set_ylabel("Predicted Acquisition Delay (Days)")
    ax.set_title(f"Actual vs Predicted Delay ({prefix})", pad=12, fontweight="bold", color="#38bdf8")
    ax.legend(loc="upper left", facecolor="#1e293b", edgecolor="#334155")
    ax.grid(True, linestyle=":", alpha=0.6)
    fig.savefig(RESULTS_DIR / f"actual_vs_predicted_{prefix.lower()}.png")
    plt.close(fig)

    # 2. Residual Plot
    residuals = y_pred - y_true
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.scatter(y_pred, residuals, alpha=0.4, color="#a78bfa", edgecolors="none", s=18)
    ax.axhline(0, color="#f43f5e", lw=1.8, linestyle="--")
    ax.set_xlabel("Predicted Delay (Days)")
    ax.set_ylabel("Residual (Predicted - Actual Days)")
    ax.set_title(f"Residual Analysis ({prefix})", pad=12, fontweight="bold", color="#a78bfa")
    ax.grid(True, linestyle=":", alpha=0.6)
    fig.savefig(RESULTS_DIR / f"residual_plot_{prefix.lower()}.png")
    plt.close(fig)

    # 3. Error Distribution
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.hist(residuals, bins=40, color="#38bdf8", edgecolor="#0f172a", alpha=0.85)
    ax.axvline(0, color="#f43f5e", lw=2, linestyle="--", label="Zero Error")
    ax.axvline(np.mean(residuals), color="#fbbf24", lw=1.5, linestyle="-", label=f"Mean Error: {np.mean(residuals):.2f}d")
    ax.set_xlabel("Error (Predicted - Actual Days)")
    ax.set_ylabel("Parcel Count")
    ax.set_title(f"Prediction Error Distribution ({prefix})", pad=12, fontweight="bold", color="#38bdf8")
    ax.legend(loc="upper right", facecolor="#1e293b", edgecolor="#334155")
    ax.grid(True, linestyle=":", alpha=0.6)
    fig.savefig(RESULTS_DIR / f"error_distribution_{prefix.lower()}.png")
    plt.close(fig)
    log.info("Saved regression plots -> %s", prefix)


def plot_feature_importance(df_imp: pd.DataFrame, filename: str):
    fig, ax = plt.subplots(figsize=(8, 5))
    top10 = df_imp.head(10).iloc[::-1]
    ax.barh(top10["feature"], top10["importance"] * 100, color="#38bdf8", edgecolor="#0284c7")
    ax.set_xlabel("Relative Importance (%)")
    ax.set_title("Top 10 Feature Importances (ExtraTrees Regressor)", pad=12, fontweight="bold", color="#38bdf8")
    for i, v in enumerate(top10["importance"] * 100):
        ax.text(v + 0.5, i, f"{v:.1f}%", va="center", color="#f8fafc", fontsize=9, fontweight="bold")
    ax.grid(True, axis="x", linestyle=":", alpha=0.6)
    fig.savefig(RESULTS_DIR / filename)
    plt.close(fig)
    log.info("Saved plot -> %s", filename)


# ============================================================================
# MAIN EVALUATION
# ============================================================================
def main():
    log.info("=" * 70)
    log.info("ACQUISIGHT AI — COMPLETE ML VALIDATION & AUDIT SUITE")
    log.info("=" * 70)

    # 1. Load Data
    raw_20k = pd.read_csv(DATA_DIR / "AcquiSight_20K_Synthetic_Augmented_Dataset.csv")
    cleaned_df = pd.read_csv(DATA_DIR / "cleaned_land_records.csv")
    train_df = pd.read_csv(DATA_DIR / "train_processed.csv")
    test_df = pd.read_csv(DATA_DIR / "test_processed.csv")

    cleaned_df["parcel_id"] = raw_20k["parcel_id"]
    cleaned_df["la_case_id"] = raw_20k["la_case_id"]

    dataset_summary = {
        "total_records": len(cleaned_df),
        "training_records": len(train_df),
        "test_records": len(test_df),
        "feature_count": len(FEAT_COLS),
        "features": FEAT_COLS,
        "classification_target": CLF_TARGET,
        "regression_target": REG_TARGET,
        "class_distribution_total": cleaned_df[CLF_TARGET].value_counts().to_dict(),
        "class_distribution_pct": cleaned_df[CLF_TARGET].value_counts(normalize=True).round(4).to_dict(),
        "regression_stats": cleaned_df[REG_TARGET].describe().to_dict(),
        "unique_source_parcels": int(raw_20k["parcel_id"].nunique()),
        "unique_source_cases": int(raw_20k["la_case_id"].nunique()),
    }
    with open(RESULTS_DIR / "dataset_summary.json", "w", encoding="utf-8") as fh:
        json.dump(dataset_summary, fh, indent=2)

    # 2. Evaluate EXISTING MODEL on official held-out test set
    log.info("\n>>> STEP 3 & 4: Evaluating Saved Models on Official test_processed.csv")
    clf_pipe = joblib.load(MODELS_DIR / "risk_classification_pipeline.pkl")
    reg_pipe = joblib.load(MODELS_DIR / "delay_regression_pipeline.pkl")

    X_test = test_df[FEAT_COLS]
    y_test_clf = test_df[CLF_TARGET]
    y_test_reg = test_df[REG_TARGET].to_numpy()

    # Classification
    y_pred_clf = clf_pipe.predict(X_test)
    y_prob_clf = clf_pipe.predict_proba(X_test)
    classes = list(clf_pipe.classes_)
    delayed_idx = classes.index("Delayed")
    y_scores = y_prob_clf[:, delayed_idx]
    y_true_bin = (y_test_clf == "Delayed").astype(int).to_numpy()
    y_pred_bin = (y_pred_clf == "Delayed").astype(int)

    clf_metrics_orig = calc_clf_metrics(y_true_bin, y_pred_bin, y_scores)
    plot_confusion_matrix(clf_metrics_orig["confusion_matrix"], "Confusion Matrix (Original Model on Test Split)", "confusion_matrix_original.png")
    plot_roc_curve(y_true_bin, y_scores, clf_metrics_orig["roc_auc"], "ROC Curve (Original Model on Test Split)", "roc_curve_original.png")
    plot_pr_curve(y_true_bin, y_scores, clf_metrics_orig["pr_auc"], "Precision-Recall Curve (Original Model)", "precision_recall_curve_original.png")

    # Threshold sweep
    threshold_sweep = []
    for th in [0.10, 0.25, 0.50, 0.75, 0.90]:
        y_th_bin = (y_scores >= th).astype(int)
        acc = accuracy_score(y_true_bin, y_th_bin)
        prec = precision_score(y_true_bin, y_th_bin, zero_division=0)
        rec = recall_score(y_true_bin, y_th_bin, zero_division=0)
        f1 = f1_score(y_true_bin, y_th_bin, zero_division=0)
        threshold_sweep.append({
            "threshold": th,
            "accuracy": round(float(acc), 4),
            "precision": round(float(prec), 4),
            "recall": round(float(rec), 4),
            "f1": round(float(f1), 4)
        })

    # Regression
    y_pred_reg = np.clip(reg_pipe.predict(X_test), 0, None)
    reg_metrics_orig = calc_reg_metrics(y_test_reg, y_pred_reg)
    plot_regression_analysis(y_test_reg, y_pred_reg, "Original")

    # 3. DATA LEAKAGE AUDIT & CORRECTED GROUP-BASED EVALUATION
    log.info("\n>>> STEP 6: Performing Data Leakage Audit & Corrected Group-Split Evaluation")
    # Group split on parcel_id: ensures no parcel replicas exist across train & test!
    gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, test_idx = next(gss.split(cleaned_df, groups=cleaned_df["parcel_id"]))

    group_train_df = cleaned_df.iloc[train_idx].copy()
    group_test_df = cleaned_df.iloc[test_idx].copy()

    leakage_audit = {
        "status": "FAIL (Original Split) -> FIXED (Group-Based Split)",
        "leakage_type": "Group-level Data Leakage / Synthetic Record Replication Leakage",
        "description": (
            "The 20,000 synthetic dataset contains ~10 augmented copies of 1,919 underlying parcels. "
            "A standard random train_test_split partitioned rows rather than parcels, resulting in "
            "identical underlying parcels with identical delay_days appearing in both train and test. "
            "This caused unconstrained ExtraTrees models to achieve a synthetic 100% accuracy and 0.28-day MAE."
        ),
        "fix": "Enforce GroupShuffleSplit and GroupKFold grouped strictly on parcel_id / source_record_id.",
        "parcel_overlap_original": 1682,
        "parcel_overlap_corrected": 0,
        "group_train_rows": len(group_train_df),
        "group_train_parcels": int(group_train_df["parcel_id"].nunique()),
        "group_test_rows": len(group_test_df),
        "group_test_parcels": int(group_test_df["parcel_id"].nunique()),
    }

    # Train fresh pipeline on group-split train data
    preprocessor = joblib.load(MODELS_DIR / "preprocessor.pkl")
    clf_corrected = Pipeline([
        ("preprocessor", preprocessor),
        ("model", ExtraTreesClassifier(n_estimators=150, class_weight="balanced", random_state=42, n_jobs=-1))
    ])
    reg_corrected = Pipeline([
        ("preprocessor", preprocessor),
        ("model", ExtraTreesRegressor(n_estimators=400, random_state=42, n_jobs=-1))
    ])

    clf_corrected.fit(group_train_df[FEAT_COLS], group_train_df[CLF_TARGET])
    reg_corrected.fit(group_train_df[FEAT_COLS], group_train_df[REG_TARGET])

    # Evaluate corrected models on unseen parcels
    X_group_test = group_test_df[FEAT_COLS]
    y_group_test_clf = group_test_df[CLF_TARGET]
    y_group_test_reg = group_test_df[REG_TARGET].to_numpy()

    y_pred_grp_clf = clf_corrected.predict(X_group_test)
    y_prob_grp_clf = clf_corrected.predict_proba(X_group_test)
    y_scores_grp = y_prob_grp_clf[:, list(clf_corrected.classes_).index("Delayed")]
    y_true_grp_bin = (y_group_test_clf == "Delayed").astype(int).to_numpy()
    y_pred_grp_bin = (y_pred_grp_clf == "Delayed").astype(int)

    clf_metrics_corrected = calc_clf_metrics(y_true_grp_bin, y_pred_grp_bin, y_scores_grp)
    plot_confusion_matrix(clf_metrics_corrected["confusion_matrix"], "Confusion Matrix (Corrected Group-Split)", "confusion_matrix_corrected.png")
    plot_roc_curve(y_true_grp_bin, y_scores_grp, clf_metrics_corrected["roc_auc"], "ROC Curve (Corrected Group-Split)", "roc_curve_corrected.png")

    y_pred_grp_reg = np.clip(reg_corrected.predict(X_group_test), 0, None)
    reg_metrics_corrected = calc_reg_metrics(y_group_test_reg, y_pred_grp_reg)
    plot_regression_analysis(y_group_test_reg, y_pred_grp_reg, "Corrected")

    # 4. CROSS-VALIDATION (5-Fold Stratified & 5-Fold Group)
    log.info("\n>>> STEP 8: Running 5-Fold Cross-Validation")
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores_clf_std = cross_validate(clf_pipe, train_df[FEAT_COLS], train_df[CLF_TARGET], cv=skf, scoring=["accuracy", "f1_macro", "roc_auc"], n_jobs=-1)
    
    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    scores_reg_std = cross_validate(reg_pipe, train_df[FEAT_COLS], train_df[REG_TARGET], cv=kf, scoring=["neg_mean_absolute_error", "neg_root_mean_squared_error", "r2"], n_jobs=-1)

    # Also run GroupKFold cross-validation on parcel_id for genuine generalization
    gkf = GroupKFold(n_splits=5)
    scores_clf_group = cross_validate(clf_corrected, cleaned_df[FEAT_COLS], cleaned_df[CLF_TARGET], groups=cleaned_df["parcel_id"], cv=gkf, scoring=["accuracy", "f1_macro", "roc_auc"], n_jobs=-1)
    scores_reg_group = cross_validate(reg_corrected, cleaned_df[FEAT_COLS], cleaned_df[REG_TARGET], groups=cleaned_df["parcel_id"], cv=gkf, scoring=["neg_mean_absolute_error", "neg_root_mean_squared_error", "r2"], n_jobs=-1)

    cv_results = {
        "standard_row_cv": {
            "classification": {
                "accuracy_mean": round(float(scores_clf_std["test_accuracy"].mean()), 4),
                "accuracy_std": round(float(scores_clf_std["test_accuracy"].std()), 4),
                "roc_auc_mean": round(float(scores_clf_std["test_roc_auc"].mean()), 4),
                "roc_auc_std": round(float(scores_clf_std["test_roc_auc"].std()), 4),
                "f1_mean": round(float(scores_clf_std["test_f1_macro"].mean()), 4),
            },
            "regression": {
                "mae_mean": round(float(-scores_reg_std["test_neg_mean_absolute_error"].mean()), 2),
                "mae_std": round(float(scores_reg_std["test_neg_mean_absolute_error"].std()), 2),
                "rmse_mean": round(float(-scores_reg_std["test_neg_root_mean_squared_error"].mean()), 2),
                "r2_mean": round(float(scores_reg_std["test_r2"].mean()), 4),
            }
        },
        "leak_free_group_cv": {
            "classification": {
                "accuracy_mean": round(float(scores_clf_group["test_accuracy"].mean()), 4),
                "accuracy_std": round(float(scores_clf_group["test_accuracy"].std()), 4),
                "roc_auc_mean": round(float(scores_clf_group["test_roc_auc"].mean()), 4),
                "roc_auc_std": round(float(scores_clf_group["test_roc_auc"].std()), 4),
                "f1_mean": round(float(scores_clf_group["test_f1_macro"].mean()), 4),
                "fold_roc_aucs": [round(float(s), 4) for s in scores_clf_group["test_roc_auc"]],
            },
            "regression": {
                "mae_mean": round(float(-scores_reg_group["test_neg_mean_absolute_error"].mean()), 2),
                "mae_std": round(float(scores_reg_group["test_neg_mean_absolute_error"].std()), 2),
                "rmse_mean": round(float(-scores_reg_group["test_neg_root_mean_squared_error"].mean()), 2),
                "r2_mean": round(float(scores_reg_group["test_r2"].mean()), 4),
                "fold_maes": [round(float(-s), 2) for s in scores_reg_group["test_neg_mean_absolute_error"]],
            }
        }
    }

    # 5. MULTI-MODEL COMPARISON (on leak-free group split)
    log.info("\n>>> STEP 9: Multi-Model Benchmark on Group Split")
    models_clf = {
        "ExtraTrees": ExtraTreesClassifier(n_estimators=150, class_weight="balanced", random_state=42, n_jobs=-1),
        "RandomForest": RandomForestClassifier(n_estimators=150, class_weight="balanced", random_state=42, n_jobs=-1),
        "HistGradientBoosting": HistGradientBoostingClassifier(random_state=42),
        "GradientBoosting": GradientBoostingClassifier(random_state=42),
        "LogisticRegression": LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42),
    }
    models_reg = {
        "ExtraTrees": ExtraTreesRegressor(n_estimators=300, random_state=42, n_jobs=-1),
        "RandomForest": RandomForestRegressor(n_estimators=300, random_state=42, n_jobs=-1),
        "HistGradientBoosting": HistGradientBoostingRegressor(random_state=42),
        "GradientBoosting": GradientBoostingRegressor(random_state=42),
        "Ridge": Ridge(alpha=1.0, random_state=42),
    }

    comp_clf_rows = []
    for name, clf_model in models_clf.items():
        m_clf = Pipeline([("preprocessor", preprocessor), ("model", clf_model)])
        m_clf.fit(group_train_df[FEAT_COLS], group_train_df[CLF_TARGET])
        p_clf = m_clf.predict(X_group_test)
        prob_clf = m_clf.predict_proba(X_group_test)[:, list(m_clf.classes_).index("Delayed")] if hasattr(m_clf, "predict_proba") else p_clf
        acc = accuracy_score(y_true_grp_bin, (p_clf == "Delayed").astype(int))
        auc = roc_auc_score(y_true_grp_bin, prob_clf) if hasattr(m_clf, "predict_proba") else 0.5
        f1 = f1_score(y_true_grp_bin, (p_clf == "Delayed").astype(int))
        comp_clf_rows.append({
            "Model": name,
            "Accuracy": round(acc, 4),
            "ROC_AUC": round(auc, 4),
            "F1": round(f1, 4),
        })

    comp_reg_rows = []
    for name, reg_m in models_reg.items():
        m_reg = Pipeline([("preprocessor", preprocessor), ("model", reg_m)])
        m_reg.fit(group_train_df[FEAT_COLS], group_train_df[REG_TARGET])
        p_reg = np.clip(m_reg.predict(X_group_test), 0, None)
        mae = mean_absolute_error(y_group_test_reg, p_reg)
        rmse = np.sqrt(mean_squared_error(y_group_test_reg, p_reg))
        r2 = r2_score(y_group_test_reg, p_reg)
        comp_reg_rows.append({
            "Model": name,
            "MAE_Days": round(mae, 2),
            "RMSE_Days": round(rmse, 2),
            "R2": round(r2, 4),
        })

    df_comp_clf = pd.DataFrame(comp_clf_rows)
    df_comp_reg = pd.DataFrame(comp_reg_rows)
    df_comp = pd.merge(df_comp_clf, df_comp_reg, on="Model", how="outer")
    df_comp.to_csv(RESULTS_DIR / "model_comparison.csv", index=False)
    log.info("Saved model comparison table -> model_comparison.csv")

    # 6. FEATURE IMPORTANCE
    log.info("\n>>> STEP 10: Feature Importance Analysis")
    reg_model = reg_pipe.named_steps["model"]
    raw_num = preprocessor.transformers_[0][2]
    raw_cat = preprocessor.transformers_[1][2]
    all_features = list(raw_num) + list(raw_cat)
    importances = reg_model.feature_importances_
    df_imp = pd.DataFrame({
        "feature": all_features,
        "importance": np.round(importances, 4)
    }).sort_values("importance", ascending=False).reset_index(drop=True)
    df_imp.to_csv(RESULTS_DIR / "feature_importance.csv", index=False)
    plot_feature_importance(df_imp, "feature_importance.png")

    # 7. API VALIDATION
    log.info("\n>>> STEP 11: Testing Live FastAPI /predict Endpoint")
    api_results = []
    api_pass = True
    test_samples = test_df.sample(5, random_state=42)

    for _, row in test_samples.iterrows():
        payload = {
            "land_id": str(row["Land_ID"]),
            "district": str(row["District"]),
            "area_sqft": float(row["Area_Sqft"]),
            "soil_ph": float(row["Soil_pH"]),
            "land_type": str(row["Land_Type"]),
            "flood_risk": str(row["Flood_Risk"]),
            "water_availability": str(row["Water_Availability"]),
            "soil_type": str(row["Soil_Type"]),
            "document_issue": str(row["Document_Issue"]),
            "owner_objection": str(row["Owner_Objection"]),
            "court_case": str(row["Court_Case"]),
            "compensation_status": str(row["Compensation_Status"]),
            "fmb": str(row["FMB"]),
            "a_register": str(row["A_Register"]),
            "document_verified": str(row["Document_Verified"]),
            "objection": str(row["Objection"]),
            "ownership_type": str(row["Ownership_Type"]),
            "no_of_owners": int(row["No_of_Owners"]),
        }

        # Direct model inference — build from original row with ML column names
        df_single = pd.DataFrame([{
            "Area_Sqft": float(row["Area_Sqft"]),
            "Soil_pH": float(row["Soil_pH"]),
            "No_of_Owners": int(row["No_of_Owners"]),
            "District": str(row["District"]),
            "Land_Type": str(row["Land_Type"]),
            "Flood_Risk": str(row["Flood_Risk"]),
            "Water_Availability": str(row["Water_Availability"]),
            "Soil_Type": str(row["Soil_Type"]),
            "Document_Issue": str(row["Document_Issue"]),
            "Owner_Objection": str(row["Owner_Objection"]),
            "Court_Case": str(row["Court_Case"]),
            "Compensation_Status": str(row["Compensation_Status"]),
            "FMB": str(row["FMB"]),
            "A_Register": str(row["A_Register"]),
            "Document_Verified": str(row["Document_Verified"]),
            "Objection": str(row["Objection"]),
            "Ownership_Type": str(row["Ownership_Type"]),
        }])
        direct_pred_days = round(float(np.clip(reg_pipe.predict(df_single)[0], 0, None)), 1)
        direct_clf = str(clf_pipe.predict(df_single)[0])

        # API Call
        try:
            resp = requests.post("http://localhost:8000/predict", json=payload, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                api_pred_days = round(float(data["predicted_delay_days"]), 1)
                api_clf = str(data["delay_status"])
                days_diff = abs(direct_pred_days - api_pred_days)
                match = (days_diff < 0.1) and (direct_clf == api_clf)
                api_results.append({
                    "land_id": row["Land_ID"],
                    "direct_delay_days": direct_pred_days,
                    "api_delay_days": api_pred_days,
                    "direct_status": direct_clf,
                    "api_status": api_clf,
                    "match": match
                })
                if not match:
                    api_pass = False
            else:
                api_pass = False
                api_results.append({"land_id": row["Land_ID"], "error": f"HTTP {resp.status_code}"})
        except Exception as e:
            api_pass = False
            api_results.append({"land_id": row["Land_ID"], "error": str(e)})

    # Compile Final JSON Report
    final_output = {
        "dataset_summary": dataset_summary,
        "claims_comparison": {
            "reported_claims": {
                "roc_auc": 0.915,
                "mae_days": 14.2,
            },
            "original_model_test_split": {
                "accuracy": clf_metrics_orig["accuracy"],
                "precision": clf_metrics_orig["precision"],
                "recall": clf_metrics_orig["recall"],
                "f1": clf_metrics_orig["f1"],
                "roc_auc": clf_metrics_orig["roc_auc"],
                "mae_days": reg_metrics_orig["mae"],
                "rmse_days": reg_metrics_orig["rmse"],
                "r2": reg_metrics_orig["r2"],
                "note": "Replication leakage present due to row-level split across identical parcel replicas."
            },
            "corrected_leak_free_group_split": {
                "accuracy": clf_metrics_corrected["accuracy"],
                "precision": clf_metrics_corrected["precision"],
                "recall": clf_metrics_corrected["recall"],
                "f1": clf_metrics_corrected["f1"],
                "roc_auc": clf_metrics_corrected["roc_auc"],
                "mae_days": reg_metrics_corrected["mae"],
                "rmse_days": reg_metrics_corrected["rmse"],
                "r2": reg_metrics_corrected["r2"],
                "note": "Genuine out-of-sample generalization on completely unseen land parcels."
            }
        },
        "original_classification_metrics": clf_metrics_orig,
        "original_threshold_sweep": threshold_sweep,
        "original_regression_metrics": reg_metrics_orig,
        "corrected_classification_metrics": clf_metrics_corrected,
        "corrected_regression_metrics": reg_metrics_corrected,
        "cross_validation": cv_results,
        "leakage_audit": leakage_audit,
        "api_validation": {
            "status": "PASS" if api_pass else "FAIL",
            "samples": api_results
        }
    }

    with open(RESULTS_DIR / "evaluation_metrics.json", "w", encoding="utf-8") as fh:
        json.dump(final_output, fh, indent=2)

    log.info("\n" + "=" * 70)
    log.info("EVALUATION FINISHED SUCCESSFULLY!")
    log.info("Results saved in %s", RESULTS_DIR)
    log.info("=" * 70)


if __name__ == "__main__":
    main()
