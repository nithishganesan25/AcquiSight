import math
from pathlib import Path
import sys

import pandas as pd
import streamlit as st

APP_DIR = Path(__file__).resolve().parent
PROJECT_DIR = APP_DIR.parent
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))
if str(PROJECT_DIR / "src") not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR / "src"))

from gis_utils import attach_approx_coords  # noqa: E402

folium = None
MarkerCluster = None
Fullscreen = None
st_folium = None

RISK_COLORS = {"Low": "#2E7D32", "Medium": "#F9A825", "High": "#C62828"}
STATUS_COLORS = {"No Delay": "#1565C0", "Delayed": "#C62828"}


def check_folium():
    global folium, MarkerCluster, Fullscreen, st_folium
    if folium is not None and st_folium is not None:
        return True
    try:
        import folium as _folium
        from folium.plugins import Fullscreen as _Fullscreen
        from folium.plugins import MarkerCluster as _MarkerCluster
        from streamlit_folium import st_folium as _st_folium

        folium = _folium
        MarkerCluster = _MarkerCluster
        Fullscreen = _Fullscreen
        st_folium = _st_folium
        return True
    except ImportError:
        return False


SCORED_FILE = PROJECT_DIR / "data" / "land_records_scored.csv"
CLEANED_FILE = PROJECT_DIR / "data" / "cleaned_land_records.csv"


@st.cache_data(ttl=300)
def load_gis_data():
    path = SCORED_FILE if SCORED_FILE.exists() else CLEANED_FILE
    if not path.exists():
        return None
    df = pd.read_csv(path)
    if "latitude" not in df.columns or df["latitude"].isna().all():
        df = attach_approx_coords(df)
    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
    return df.dropna(subset=["latitude", "longitude"]).copy()


def _color(row):
    risk = str(row.get("Predicted_Risk_Category") or row.get("Delay_Risk_Band") or "")
    return RISK_COLORS.get(risk, "#455A64")


def render_gis_map():
    st.title("GIS Land Acquisition Map")
    st.caption("Official gazette land records with model predictions on the same Land ID.")
    st.warning(
        "Approximate locations only. The gazette workbook has no survey-parcel latitude/longitude. "
        "Markers are jittered around district centroids so villages can be browsed — they are not cadastral points."
    )

    df = load_gis_data()
    if df is None or len(df) == 0:
        st.error("Land GIS dataset not found. Run `python src/Train_model.py` first.")
        return

    st.success(f"Loaded {len(df):,} gazette land records")

    st.sidebar.header("GIS Filters")
    if st.sidebar.button("Refresh GIS Data"):
        st.cache_data.clear()
        st.rerun()

    search = st.sidebar.text_input("Search Land ID / Village / Survey No", "")
    districts = sorted(df["District"].dropna().astype(str).unique().tolist())
    selected_district = st.sidebar.selectbox("District", ["All Districts"] + districts)

    if selected_district != "All Districts":
        taluks = sorted(df.loc[df["District"].astype(str) == selected_district, "Taluk"].dropna().astype(str).unique().tolist())
        selected_taluk = st.sidebar.selectbox("Taluk", ["All Taluks"] + taluks)
    else:
        selected_taluk = "All Taluks"

    risk_col = "Predicted_Risk_Category" if "Predicted_Risk_Category" in df.columns else "Delay_Risk_Band"
    risks = ["Low", "Medium", "High"]
    selected_risk = st.sidebar.multiselect("Predicted risk band (from predicted days)", risks, default=risks)

    delay_values = pd.to_numeric(
        df.get("Predicted_Delay_Days", df.get("Acquisition_Days")), errors="coerce"
    ).dropna()
    delay_min = math.floor(float(delay_values.min()))
    delay_max = math.ceil(float(delay_values.max()))
    delay_range = st.sidebar.slider(
        "Predicted delay days",
        min_value=delay_min,
        max_value=max(delay_max, delay_min + 1),
        value=(delay_min, delay_max),
    )

    map_tile_choice = st.sidebar.radio("Base map", ["🗺️ OpenStreetMap", "🛰️ Satellite (Esri)"], index=0)
    if "Satellite" in map_tile_choice:
        map_tile = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        tile_attr = "Esri"
    else:
        map_tile = "OpenStreetMap"
        tile_attr = "OpenStreetMap"

    filtered = df.copy()
    if search.strip():
        q = search.strip().lower()
        mask = False
        for col in ["Land_ID", "Village", "Survey_No", "Taluk", "District"]:
            mask = mask | filtered[col].astype(str).str.lower().str.contains(q, na=False)
        filtered = filtered[mask]
    if selected_district != "All Districts":
        filtered = filtered[filtered["District"].astype(str) == selected_district]
    if selected_taluk != "All Taluks":
        filtered = filtered[filtered["Taluk"].astype(str) == selected_taluk]
    if selected_risk and risk_col in filtered.columns:
        filtered = filtered[filtered[risk_col].astype(str).isin(selected_risk)]
    pred_days = pd.to_numeric(filtered.get("Predicted_Delay_Days", filtered.get("Acquisition_Days")), errors="coerce")
    filtered = filtered[(pred_days >= delay_range[0]) & (pred_days <= delay_range[1])]

    if len(filtered) == 0:
        st.error("No parcels match the selected filters.")
        return

    st.info(f"Showing {len(filtered):,} matching records")

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Records", f"{len(filtered):,}")
    c2.metric("Districts", int(filtered["District"].nunique()))
    delayed = int((filtered["Delay_Status"].astype(str) == "Delayed").sum()) if "Delay_Status" in filtered.columns else 0
    c3.metric("Recorded Delayed", delayed)
    if "Predicted_Delay_Days" in filtered.columns:
        c4.metric("Avg predicted days", f"{pd.to_numeric(filtered['Predicted_Delay_Days'], errors='coerce').mean():.0f}")
    else:
        c4.metric("Avg recorded days", f"{pd.to_numeric(filtered['Acquisition_Days'], errors='coerce').mean():.0f}")

    st.markdown("---")
    st.subheader("Interactive map")

    if not check_folium():
        st.warning("Install map libraries: `pip install folium streamlit-folium`")
    else:
        center_lat = float(filtered["latitude"].mean())
        center_lon = float(filtered["longitude"].mean())
        zoom_level = 12 if selected_taluk != "All Taluks" else (9 if selected_district != "All Districts" else 7)
        m = folium.Map(location=[center_lat, center_lon], zoom_start=zoom_level, tiles=map_tile, attr=tile_attr, control_scale=True)
        Fullscreen(position="topright").add_to(m)
        cluster = MarkerCluster(name="Land records", options={"maxClusterRadius": 35, "spiderfyOnMaxZoom": True}).add_to(m)

        for _, row in filtered.iterrows():
            color = _color(row)
            pred = row.get("Predicted_Delay_Days", "n/a")
            actual = row.get("Acquisition_Days", "n/a")
            risk = row.get("Predicted_Risk_Category", row.get("Delay_Risk_Band", "n/a"))
            popup_html = f"""
            <div style="font-family:Arial;min-width:260px;font-size:13px;line-height:1.5">
              <h4 style="margin:0 0 8px 0;color:#1E3A8A">{row.get('Land_ID','')}</h4>
              <b>District:</b> {row.get('District','')}<br>
              <b>Taluk:</b> {row.get('Taluk','')}<br>
              <b>Village:</b> {row.get('Village','')}<br>
              <b>Survey No:</b> {row.get('Survey_No','')}<br>
              <b>Land type:</b> {row.get('Land_Type','')}<br><br>
              <b>Recorded delay status:</b> {row.get('Delay_Status','')}<br>
              <b>Recorded acquisition days:</b> {actual}<br>
              <b>Predicted delay days:</b> {pred}<br>
              <b>Predicted risk band:</b> {risk}<br>
              <b>Predicted delay status:</b> {row.get('Predicted_Delay_Status','')}<br><br>
              <small>Location: approximate village/district centroid, not the survey parcel.</small>
            </div>
            """
            folium.CircleMarker(
                location=[row["latitude"], row["longitude"]],
                radius=7,
                popup=folium.Popup(popup_html, max_width=340),
                tooltip=f"{row.get('Land_ID')} | {row.get('Village')} | {risk}",
                color=color,
                fill=True,
                fill_color=color,
                fill_opacity=0.85,
                weight=2,
            ).add_to(cluster)

        if len(filtered) > 1:
            m.fit_bounds(
                [
                    [filtered["latitude"].min(), filtered["longitude"].min()],
                    [filtered["latitude"].max(), filtered["longitude"].max()],
                ],
                padding=(30, 30),
            )
        st.markdown("**Marker colour = predicted risk band (from predicted days)**")
        legend = st.columns(3)
        for i, (name, color) in enumerate(RISK_COLORS.items()):
            legend[i].markdown(
                f'<span style="display:inline-block;width:12px;height:12px;background:{color};border-radius:50%;margin-right:6px"></span> **{name}**',
                unsafe_allow_html=True,
            )
        st_folium(m, width=None, height=620)

    st.markdown("---")
    st.subheader("Filtered records")
    show_cols = [
        c
        for c in [
            "Land_ID",
            "District",
            "Taluk",
            "Village",
            "Survey_No",
            "Land_Type",
            "Delay_Status",
            "Acquisition_Days",
            "Predicted_Delay_Days",
            "Predicted_Delay_Status",
            "Predicted_Risk_Category",
            "Court_Case",
            "Owner_Objection",
        ]
        if c in filtered.columns
    ]
    st.dataframe(filtered[show_cols], use_container_width=True, hide_index=True)
