
import streamlit as st
import requests
import pandas as pd
from pathlib import Path
import sys


# ============================================================
# PAGE CONFIG
# ============================================================

st.set_page_config(
    page_title="AcquiSight AI - SIH 2026",
    page_icon="🏞️",
    layout="wide",
    initial_sidebar_state="expanded"
)


# ============================================================
# PROJECT PATHS
# ============================================================

# app.py lives at:  ACQUISIGHT/dashboard/app.py
# project root is:  ACQUISIGHT/

APP_DIR = Path(__file__).resolve().parent
PROJECT_DIR = APP_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
MODELS_DIR = PROJECT_DIR / "models"

# Real gazette dataset (produced by src/Train_model.py)
SCORED_CSV   = DATA_DIR / "land_records_scored.csv"
CLEANED_CSV  = DATA_DIR / "cleaned_land_records.csv"

API_URL = "http://localhost:8000"

# GIS Map module import
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

try:
    from dashboard.gis_map import render_gis_map
except ImportError:
    from gis_map import render_gis_map


# ============================================================
# CUSTOM CSS  — unchanged from original
# ============================================================

st.markdown(
    """
    <style>

    .main-title {
        font-size: 42px;
        font-weight: 700;
        margin-bottom: 0px;
    }

    .subtitle {
        font-size: 18px;
        color: #666666;
        margin-bottom: 25px;
    }

    </style>
    """,
    unsafe_allow_html=True
)


# ============================================================
# DATA LOADER  — real gazette data
# ============================================================

def load_land_data():
    """
    Load real gazette land records.

    Priority:
    1. land_records_scored.csv  (has ML predictions attached)
    2. cleaned_land_records.csv (after prepare_real_data runs)

    Both are produced by:  python src/Train_model.py
    """

    errors = []

    for path, label in [
        (SCORED_CSV,  "land_records_scored.csv"),
        (CLEANED_CSV, "cleaned_land_records.csv"),
    ]:
        if not path.exists():
            errors.append(f"Not found: {path}")
            continue

        try:
            df = pd.read_csv(path)

            if df.empty:
                raise ValueError(f"{label} is empty.")

            df = df.dropna(how="all").reset_index(drop=True)

            # Derive display risk band if not present
            if "Delay_Risk_Band" not in df.columns:
                if "Predicted_Delay_Days" in df.columns:
                    def _risk(d):
                        d = float(d) if pd.notna(d) else 120
                        return "Low" if d <= 60 else ("Medium" if d <= 120 else "High")
                    df["Delay_Risk_Band"] = df["Predicted_Delay_Days"].apply(_risk)
                elif "Acquisition_Days" in df.columns:
                    def _risk(d):
                        d = float(d) if pd.notna(d) else 120
                        return "Low" if d <= 60 else ("Medium" if d <= 120 else "High")
                    df["Delay_Risk_Band"] = df["Acquisition_Days"].apply(_risk)

            return df, label

        except Exception as e:
            errors.append(f"{label} error: {e}")

    raise RuntimeError(
        "Real gazette data not found.\n\n"
        "Run:  python src/Train_model.py\n\n"
        "Details:\n" + "\n".join(errors)
    )


# ============================================================
# LOAD DATA
# ============================================================

try:
    df, data_source = load_land_data()

except Exception as e:

    st.error("❌ Could not load real gazette data.")

    st.markdown("### What to do")

    st.code(
        "cd ACQUISIGHT\n"
        "python src/Train_model.py",
        language="bash"
    )

    st.markdown("### Debug info")
    st.write(f"**Project folder:** `{PROJECT_DIR}`")
    st.write(f"**Data folder:** `{DATA_DIR}`")
    st.write(f"**Scored CSV exists:** `{SCORED_CSV.exists()}`")
    st.write(f"**Cleaned CSV exists:** `{CLEANED_CSV.exists()}`")
    st.code(str(e))
    st.stop()


# ============================================================
# API FUNCTIONS
# ============================================================

def check_api_status():

    try:

        response = requests.get(
            f"{API_URL}/health",
            timeout=3
        )

        return response.status_code == 200

    except requests.exceptions.RequestException:

        return False


def predict_land_risk(land_data):

    try:

        response = requests.post(
            f"{API_URL}/predict",
            json=land_data,
            timeout=30
        )

        if response.status_code == 200:

            return response.json()

        # Try to read FastAPI error
        try:

            error_data = response.json()

            if isinstance(error_data, dict):

                detail = error_data.get(
                    "detail",
                    error_data
                )

                return {
                    "error": (
                        f"API Error {response.status_code}: "
                        f"{detail}"
                    )
                }

        except Exception:

            pass

        return {
            "error": (
                f"API Error {response.status_code}: "
                f"{response.text}"
            )
        }

    except requests.exceptions.ConnectionError:

        return {
            "error": (
                "Cannot connect to FastAPI. "
                "Please start the backend with:\n"
                "uvicorn api.main:app --reload"
            )
        }

    except requests.exceptions.Timeout:

        return {
            "error": (
                "The API request timed out."
            )
        }

    except requests.exceptions.RequestException as e:

        return {
            "error": f"Request failed: {str(e)}"
        }


def get_feature_importance():

    try:

        response = requests.get(
            f"{API_URL}/feature-importance",
            timeout=5
        )

        if response.status_code != 200:
            return None

        data = response.json()

        return data

    except requests.exceptions.RequestException:

        return None


def get_categories():
    """Fetch feature categories from API (populated from feature_categories.json)."""
    try:
        response = requests.get(f"{API_URL}/feature-schema", timeout=5)
        if response.status_code == 200:
            return response.json()
    except Exception:
        pass
    return None


# ============================================================
# SIDEBAR
# ============================================================

st.sidebar.title("🏞️ AcquiSight AI")

st.sidebar.markdown("---")

st.sidebar.markdown(
    "**Smart India Hackathon 2026**"
)

st.sidebar.markdown(
    "**Problem Statement:** SIH26017"
)

st.sidebar.markdown(
    "**Team:** ThinkForge"
)

st.sidebar.markdown("---")

page = st.sidebar.radio(
    "Navigate",
    [
        "📊 Dashboard",
        "🗺️ GIS Map",
        "🔮 Predict Risk",
        "📋 Land Database",
        "ℹ️ About"
    ]
)

st.sidebar.markdown("---")

# ------------------------------------------------------------
# API status
# ------------------------------------------------------------

st.sidebar.markdown("### API Status")

if check_api_status():

    st.sidebar.success("🟢 Backend Online")

else:

    st.sidebar.error("🔴 Backend Offline")

st.sidebar.markdown("---")

st.sidebar.caption(
    f"Data source: {data_source}"
)

st.sidebar.caption(
    f"Records loaded: {len(df)}"
)


# ============================================================
# DASHBOARD
# ============================================================

if page == "📊 Dashboard":

    st.markdown(
        '<div class="main-title">AcquiSight AI</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="subtitle">'
        "AI-powered land acquisition delay intelligence"
        "</div>",
        unsafe_allow_html=True
    )

    # --------------------------------------------------------
    # Risk counts — from real Delay_Risk_Band column
    # --------------------------------------------------------

    risk_col = "Delay_Risk_Band"
    if risk_col not in df.columns:
        # fallback: derived from Predicted or Recorded days
        risk_col = "Predicted_Risk_Category" if "Predicted_Risk_Category" in df.columns else None

    if risk_col:
        risk_series = (
            df[risk_col]
            .astype(str)
            .str.strip()
            .str.title()
        )
    else:
        risk_series = pd.Series(["Medium"] * len(df))

    low_count    = int((risk_series == "Low").sum())
    medium_count = int((risk_series == "Medium").sum())
    high_count   = int((risk_series == "High").sum())

    # --------------------------------------------------------
    # Delay series — use recorded Acquisition_Days
    # --------------------------------------------------------

    delay_col = "Acquisition_Days"
    delay_series = pd.to_numeric(
        df.get(delay_col, pd.Series(dtype=float)),
        errors="coerce"
    ).dropna()

    # --------------------------------------------------------
    # Metrics
    # --------------------------------------------------------

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric(
            "Total Lands",
            f"{len(df):,}"
        )

    with col2:
        st.metric(
            "🟢 Low Risk",
            f"{low_count:,}"
        )

    with col3:
        st.metric(
            "🟡 Medium Risk",
            f"{medium_count:,}"
        )

    with col4:
        st.metric(
            "🔴 High Risk",
            f"{high_count:,}"
        )

    st.markdown("---")

    # --------------------------------------------------------
    # Charts
    # --------------------------------------------------------

    chart_col1, chart_col2 = st.columns(2)

    with chart_col1:

        st.subheader("📊 Risk Distribution")

        risk_distribution = pd.Series(
            {
                "Low": low_count,
                "Medium": medium_count,
                "High": high_count
            }
        )

        st.bar_chart(
            risk_distribution
        )

    with chart_col2:

        st.subheader("⏱️ Acquisition Duration Statistics")

        if not delay_series.empty:

            stat_col1, stat_col2 = st.columns(2)

            with stat_col1:

                st.metric(
                    "Average",
                    f"{delay_series.mean():.1f} days"
                )

                st.metric(
                    "Minimum",
                    f"{delay_series.min():.0f} days"
                )

            with stat_col2:

                st.metric(
                    "Median",
                    f"{delay_series.median():.0f} days"
                )

                st.metric(
                    "Maximum",
                    f"{delay_series.max():.0f} days"
                )

        else:
            st.info("Acquisition_Days column not available.")

    st.markdown("---")

    # --------------------------------------------------------
    # Delay Status breakdown (recorded)
    # --------------------------------------------------------

    if "Delay_Status" in df.columns:
        st.subheader("📋 Recorded Delay Status")
        ds = df["Delay_Status"].astype(str).str.strip().value_counts()
        st.bar_chart(ds)
        st.markdown("---")

    # --------------------------------------------------------
    # Feature importance from model
    # --------------------------------------------------------

    st.subheader(
        "🧠 Top Risk Factors (from trained model)"
    )

    importance = get_feature_importance()

    if importance:

        try:

            if (
                isinstance(importance, dict)
                and "features" in importance
            ):

                features = importance["features"]

                imp_df = pd.DataFrame(features)

                if (
                    "feature" in imp_df.columns
                    and "importance" in imp_df.columns
                ):

                    imp_df = imp_df[
                        ["feature", "importance"]
                    ].copy()

                    imp_df["importance"] = pd.to_numeric(
                        imp_df["importance"],
                        errors="coerce"
                    )

                    imp_df = imp_df.dropna()

                    imp_df = imp_df.sort_values(
                        "importance",
                        ascending=False
                    ).head(10)

                    imp_df["importance"] = (
                        imp_df["importance"] * 100
                    )

                    st.bar_chart(
                        imp_df.set_index("feature")
                    )

                else:

                    st.json(importance)

            else:

                st.json(importance)

        except Exception:

            st.json(importance)

    else:

        st.info(
            "Feature importance is unavailable. "
            "Start FastAPI to display model insights."
        )

    # --------------------------------------------------------
    # Sample records
    # --------------------------------------------------------

    st.markdown("---")

    st.subheader(
        "📋 Sample Land Records (Real Gazette Data)"
    )

    sample_columns = [
        "Land_ID",
        "District",
        "Taluk",
        "Village",
        "Land_Type",
        "Ownership_Type",
        "Acquisition_Days",
        "Delay_Status",
        "Delay_Risk_Band",
    ]

    sample_columns = [
        col
        for col in sample_columns
        if col in df.columns
    ]

    st.dataframe(
        df[sample_columns].head(10),
        use_container_width=True,
        hide_index=True
    )


# ============================================================
# GIS MAP
# ============================================================

elif page == "🗺️ GIS Map":

    render_gis_map()


# ============================================================
# PREDICT RISK
# ============================================================

elif page == "🔮 Predict Risk":

    st.title(
        "🔮 Predict Land Acquisition Delay Risk"
    )

    st.markdown(
        "Enter the land details and let the AI model "
        "estimate the expected acquisition delay."
    )

    st.markdown("---")

    # --------------------------------------------------------
    # Land information
    # --------------------------------------------------------

    st.subheader("📍 Land Information")

    col1, col2, col3 = st.columns(3)

    with col1:

        land_id = st.text_input(
            "Land ID",
            "LND_NEW_001"
        )

        district = st.selectbox(
            "District",
            [
                "Chengalpattu", "Coimbatore", "Dindigul", "Erode",
                "Kancheepuram", "Krishnagiri", "Madurai", "Ranipet",
                "Salem", "Thanjavur", "Tiruchirappalli", "Tirunelveli",
                "Tiruppur", "Tiruvallur",
            ],
            index=4  # Kancheepuram default
        )

        taluk = st.text_input(
            "Taluk",
            "Tiruvottiyur"
        )

    with col2:

        village = st.text_input(
            "Village",
            "Kathivakkam"
        )

        survey_no = st.text_input(
            "Survey No",
            "617/5"
        )

        area_sqft = st.number_input(
            "Area (sq.ft)",
            min_value=1.0,
            value=10000.0,
            step=100.0
        )

    with col3:

        soil_ph = st.number_input(
            "Soil pH",
            min_value=0.0,
            max_value=14.0,
            value=7.0,
            step=0.1
        )

        land_type = st.selectbox(
            "Land Type",
            [
                "Wet",
                "Dry",
                "Manavari",
            ]
        )

        soil_type = st.selectbox(
            "Soil Type",
            [
                "Red Soil",
                "Black Soil",
                "Alluvial Soil",
                "Clay Soil",
            ]
        )

    st.markdown("---")

    # --------------------------------------------------------
    # Ownership & Legal
    # --------------------------------------------------------

    st.subheader(
        "👥 Ownership & Legal Details"
    )

    col1, col2, col3 = st.columns(3)

    with col1:

        no_of_owners = st.number_input(
            "No. of Owners",
            min_value=1,
            value=1,
            step=1
        )

        ownership_type = st.selectbox(
            "Ownership Type",
            [
                "Individual",
                "Joint",
            ]
        )

        owner_objection = st.selectbox(
            "Owner Objection",
            ["No", "Yes"]
        )

    with col2:

        court_case = st.selectbox(
            "Court Case",
            ["No", "Yes"]
        )

        objection = st.selectbox(
            "Objection Filed",
            ["No", "Yes"]
        )

        document_issue = st.selectbox(
            "Document Issue",
            [
                "Available",
                "Not Available",
            ]
        )

    with col3:

        document_verified = st.selectbox(
            "Documents Verified",
            ["Yes", "No"]
        )

        fmb = st.selectbox(
            "FMB Available",
            ["Yes", "No"]
        )

        a_register = st.selectbox(
            "A-Register Available",
            ["Yes", "No"]
        )

    st.markdown("---")

    # --------------------------------------------------------
    # Environmental
    # --------------------------------------------------------

    st.subheader("🌿 Environmental Factors")

    col1, col2 = st.columns(2)

    with col1:

        flood_risk = st.selectbox(
            "Flood Risk",
            ["No", "Yes"]
        )

        water_availability = st.selectbox(
            "Water Availability",
            ["Yes", "No"]
        )

    with col2:

        compensation_status = st.selectbox(
            "Compensation Status",
            [
                "To be paid",
                "Verification completed",
                "Withheld pending court",
                "Verification pending",
                "Objection enquiry",
            ]
        )

    st.markdown("---")

    # --------------------------------------------------------
    # Prediction
    # --------------------------------------------------------

    predict_btn = st.button(
        "🚀 Predict Risk",
        type="primary",
        use_container_width=True
    )

    if predict_btn:

        # ----------------------------------------------------
        # Build API request matching LandRequest schema exactly
        # ----------------------------------------------------

        land_data = {
            "land_id":            land_id,
            "district":           district,
            "taluk":              taluk,
            "village":            village,
            "survey_no":          survey_no,
            "area_sqft":          float(area_sqft),
            "soil_ph":            float(soil_ph),
            "no_of_owners":       int(no_of_owners),
            "land_type":          land_type,
            "flood_risk":         flood_risk,
            "water_availability": water_availability,
            "soil_type":          soil_type,
            "document_issue":     document_issue,
            "owner_objection":    owner_objection,
            "court_case":         court_case,
            "compensation_status": compensation_status,
            "fmb":                fmb,
            "a_register":         a_register,
            "document_verified":  document_verified,
            "objection":          objection,
            "ownership_type":     ownership_type,
        }

        # ----------------------------------------------------
        # Send request
        # ----------------------------------------------------

        with st.spinner(
            "🤖 AI is analyzing the land..."
        ):

            result = predict_land_risk(
                land_data
            )

        # ----------------------------------------------------
        # API ERROR
        # ----------------------------------------------------

        if "error" in result:

            st.error(
                result["error"]
            )

        else:

            st.success(
                "✅ Prediction completed!"
            )

            # ------------------------------------------------
            # Safely get results
            # ------------------------------------------------

            risk_category = result.get(
                "risk_category",
                "Unknown"
            )

            predicted_delay = result.get(
                "predicted_delay_days"
            )

            risk_score = result.get(
                "risk_score"
            )

            # ------------------------------------------------
            # Result cards
            # ------------------------------------------------

            col1, col2, col3 = st.columns(3)

            with col1:

                if str(risk_category).lower() == "low":

                    st.success(
                        f"### 🟢 {risk_category} Risk"
                    )

                elif (
                    str(risk_category).lower()
                    == "medium"
                ):

                    st.warning(
                        f"### 🟡 {risk_category} Risk"
                    )

                elif (
                    str(risk_category).lower()
                    == "high"
                ):

                    st.error(
                        f"### 🔴 {risk_category} Risk"
                    )

                else:

                    st.info(
                        f"### {risk_category}"
                    )

            with col2:

                if predicted_delay is not None:

                    try:

                        st.metric(
                            "Predicted Delay",
                            f"{float(predicted_delay):.0f} days"
                        )

                    except Exception:

                        st.metric(
                            "Predicted Delay",
                            str(predicted_delay)
                        )

                else:

                    st.metric(
                        "Predicted Delay",
                        "N/A"
                    )

            with col3:

                if risk_score is not None:

                    try:

                        st.metric(
                            "Risk Score",
                            f"{float(risk_score):.1f}/100"
                        )

                    except Exception:

                        st.metric(
                            "Risk Score",
                            str(risk_score)
                        )

                else:

                    st.metric(
                        "Risk Score",
                        "N/A"
                    )

            # ------------------------------------------------
            # Delay range
            # ------------------------------------------------

            delay_range_result = result.get(
                "predicted_delay_range"
            )

            if delay_range_result:

                if isinstance(
                    delay_range_result,
                    dict
                ):

                    lower = delay_range_result.get(
                        "lower"
                    )

                    upper = delay_range_result.get(
                        "upper"
                    )

                    if (
                        lower is not None
                        and upper is not None
                    ):

                        st.info(
                            f"📅 Estimated delay range: "
                            f"{float(lower):.0f}–"
                            f"{float(upper):.0f} days"
                        )

                else:

                    st.info(
                        f"📅 Estimated delay range: "
                        f"{delay_range_result}"
                    )

            # ------------------------------------------------
            # Delay status (classification model)
            # ------------------------------------------------

            delay_status = result.get("delay_status")
            delay_prob   = result.get("delay_status_probability")

            if delay_status:
                prob_str = f" (confidence: {delay_prob:.0%})" if delay_prob is not None else ""
                st.info(f"🏷️ **Predicted Delay Status:** {delay_status}{prob_str}")

            # ------------------------------------------------
            # Risk factors
            # ------------------------------------------------

            st.markdown("---")

            st.subheader(
                "🔍 Why is this land at risk?"
            )

            risk_factors = result.get(
                "risk_factors",
                []
            )

            if risk_factors:

                if isinstance(
                    risk_factors,
                    list
                ):

                    for factor in risk_factors:

                        if isinstance(
                            factor,
                            dict
                        ):

                            factor_name = factor.get(
                                "factor",
                                "Risk Factor"
                            )

                            impact = factor.get(
                                "impact",
                                ""
                            )

                            description = factor.get(
                                "description",
                                ""
                            )

                            title = factor_name

                            if impact:
                                title += (
                                    f" ({impact})"
                                )

                            with st.expander(
                                f"⚠️ {title}"
                            ):

                                st.write(
                                    description
                                )

                        else:

                            st.warning(
                                str(factor)
                            )

                else:

                    st.warning(
                        str(risk_factors)
                    )

            else:

                st.info(
                    "No specific risk factors were returned."
                )

            # ------------------------------------------------
            # Recommendation
            # ------------------------------------------------

            recommendation = result.get(
                "recommendation"
            )

            if recommendation:

                st.markdown("---")

                st.subheader(
                    "💡 Recommended Action"
                )

                st.info(
                    str(recommendation)
                )

            # ------------------------------------------------
            # Label notes (model transparency)
            # ------------------------------------------------

            label_notes = result.get("label_notes")
            if label_notes:
                with st.expander("📌 Model Transparency Notes"):
                    for k, v in label_notes.items():
                        st.markdown(f"**{k}:** {v}")

            # ------------------------------------------------
            # Raw API response
            # ------------------------------------------------

            with st.expander(
                "🔧 View Raw API Response"
            ):

                st.json(result)


# ============================================================
# LAND DATABASE
# ============================================================

elif page == "📋 Land Database":

    st.title(
        "📋 Land Acquisition Database"
    )

    st.markdown(
        "Browse and filter the real gazette land records."
    )

    # --------------------------------------------------------
    # Filters
    # --------------------------------------------------------

    col1, col2, col3 = st.columns(3)

    # District
    with col1:

        district_col = "District" if "District" in df.columns else None

        if district_col:
            district_values = sorted(
                df[district_col]
                .dropna()
                .astype(str)
                .unique()
                .tolist()
            )

            selected_districts = st.multiselect(
                "District",
                options=district_values,
                default=district_values
            )
        else:
            selected_districts = []

    # Risk
    with col2:

        risk_values = [
            "Low",
            "Medium",
            "High"
        ]

        selected_risks = st.multiselect(
            "Risk Band",
            options=risk_values,
            default=risk_values
        )

    # Search
    with col3:

        search_text = st.text_input(
            "🔎 Search Land ID / Village / Survey No",
            "",
            key="land_database_search",
        )
        st.button("Apply search", key="land_database_search_button")

    # --------------------------------------------------------
    # Filtering
    # --------------------------------------------------------

    filtered_df = df.copy()

    if selected_districts and district_col:

        filtered_df = filtered_df[
            filtered_df[district_col]
            .astype(str)
            .isin(selected_districts)
        ]

    risk_band_col = "Delay_Risk_Band" if "Delay_Risk_Band" in filtered_df.columns else None

    if selected_risks and risk_band_col:

        filtered_df = filtered_df[
            filtered_df[risk_band_col]
            .astype(str)
            .str.title()
            .isin(selected_risks)
        ]

    if search_text.strip():

        query = search_text.strip().lower()

        mask = pd.Series([False] * len(filtered_df), index=filtered_df.index)

        for scol in ["Land_ID", "Village", "Survey_No", "Taluk", "District"]:
            if scol in filtered_df.columns:
                mask = mask | (
                    filtered_df[scol]
                    .astype(str)
                    .str.lower()
                    .str.contains(query, na=False)
                )

        filtered_df = filtered_df[mask]

    # --------------------------------------------------------
    # Result count
    # --------------------------------------------------------

    st.markdown(
        f"### Showing {len(filtered_df):,} records"
    )

    # --------------------------------------------------------
    # Table — show relevant columns only
    # --------------------------------------------------------

    show_cols = [
        c for c in [
            "Land_ID",
            "District",
            "Taluk",
            "Village",
            "Survey_No",
            "Land_Type",
            "Ownership_Type",
            "No_of_Owners",
            "Acquisition_Days",
            "Delay_Status",
            "Delay_Risk_Band",
            "Predicted_Delay_Days",
            "Predicted_Delay_Status",
            "Predicted_Risk_Category",
            "Court_Case",
            "Owner_Objection",
            "Document_Issue",
            "Compensation_Status",
        ] if c in filtered_df.columns
    ]

    st.dataframe(
        filtered_df[show_cols],
        use_container_width=True,
        hide_index=True
    )

    # --------------------------------------------------------
    # Download
    # --------------------------------------------------------

    csv_data = filtered_df[show_cols].to_csv(
        index=False
    ).encode("utf-8")

    st.download_button(
        "📥 Download Filtered CSV",
        data=csv_data,
        file_name="acquisight_filtered_lands.csv",
        mime="text/csv",
        use_container_width=True
    )


# ============================================================
# ABOUT
# ============================================================

elif page == "ℹ️ About":

    st.title(
        "ℹ️ About AcquiSight AI"
    )

    st.markdown(
        """
        ## 🏆 Smart India Hackathon 2026

        **Problem Statement:** SIH26017

        **Team:** ThinkForge

        ---

        ## 🎯 Project Overview

        AcquiSight AI is an AI-powered decision-support
        system designed to identify land acquisition cases
        that are likely to experience delays.

        The system analyses real gazette land records,
        ownership, legal, documentation, and environmental
        factors using a trained machine learning pipeline.

        ### Key Features

        - 🤖 AI-based delay prediction (Acquisition Days)
        - 📊 Low / Medium / High risk band classification
        - 🔍 Risk-factor explanation
        - 💡 Recommended actions
        - 📋 Real gazette land database
        - 📈 Analytics dashboard
        - 🗺️ GIS interactive map

        ---

        ## 🛠️ Technology Stack

        - **Frontend:** Streamlit
        - **Backend:** FastAPI
        - **Machine Learning:** Scikit-learn (Random Forest / Extra Trees)
        - **Data Processing:** Pandas / NumPy
        - **GIS Visualisation:** Folium + streamlit-folium
        - **Data Source:** Official gazette workbook (500 records)
        """

    )

    st.markdown("---")

    # --------------------------------------------------------
    # Live model metrics from metadata
    # --------------------------------------------------------

    st.subheader(
        "📊 Model Performance (from training)"
    )

    metadata_path = MODELS_DIR / "model_metadata.json"

    if metadata_path.exists():
        import json
        with open(metadata_path, encoding="utf-8") as fh:
            meta = json.load(fh)

        reg_metrics = meta.get("regression", {}).get("metrics", {}).get("final", {})
        clf_metrics = meta.get("classification", {}).get("metrics", {}).get("final", {})

        if reg_metrics:
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Test MAE", f"{reg_metrics.get('test', {}).get('mae', 'N/A')} days")
            with col2:
                st.metric("Test RMSE", f"{reg_metrics.get('test', {}).get('rmse', 'N/A')} days")
            with col3:
                st.metric("Test R²", reg_metrics.get("test", {}).get("r2", "N/A"))

        if clf_metrics:
            col1, col2 = st.columns(2)
            with col1:
                st.metric("Classifier Accuracy", clf_metrics.get("test", {}).get("accuracy", "N/A"))
            with col2:
                st.metric("Classifier F1 (macro)", clf_metrics.get("test", {}).get("f1_macro", "N/A"))

        ds = meta.get("dataset", {})
        if ds:
            st.info(
                f"Dataset: {ds.get('source','')}, "
                f"{ds.get('cleaned_rows','?')} records, "
                f"trained {meta.get('trained_at','')[:10]}"
            )

        st.warning(
            ds.get("note",
                "Prototype evaluation on gazette-derived records. "
                "Do not treat as real-world production accuracy.")
        )

    else:
        st.info("Run `python src/Train_model.py` to generate model metrics.")

    st.markdown("---")

    st.subheader(
        "📚 Dataset"
    )

    st.write(
        f"Records loaded: **{len(df):,}**"
    )

    st.write(
        "Primary source: **land acquisition_01.xlsx** — "
        "500 official gazette parcel records across 4 sheets "
        "(Land_Basic_Data, Acquisition_Delay, Document_Status, Source_Master)."
    )

    st.markdown("---")

    st.caption(
        "AcquiSight AI — Team ThinkForge — SIH 2026"
    )


# ============================================================
# FOOTER
# ============================================================

st.sidebar.markdown("---")

st.sidebar.caption(
    "Built with ❤️ for Smart India Hackathon 2026"
)
