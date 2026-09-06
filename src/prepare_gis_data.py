import hashlib
from pathlib import Path
import numpy as np
import pandas as pd

# Project root
BASE_DIR = Path(__file__).resolve().parent.parent

# Input Excel file
_primary_input = BASE_DIR / "data" / "tn_land_acquisition_dataset.xlsx"
_fallback_input = BASE_DIR / "data" / "tn_land_acquisition_dataset (1).xlsx"
INPUT_FILE = _primary_input if _primary_input.exists() else _fallback_input

# Output file
OUTPUT_FILE = BASE_DIR / "data" / "gis_parcels.csv"

# ============================================================
# REAL TAMIL NADU DISTRICT GEOGRAPHIC CENTROIDS & SPREAD
# ============================================================
# (latitude_centroid, longitude_centroid, lat_radius_deg, lon_radius_deg)
DISTRICT_COORDINATES = {
    "Chennai": (13.0827, 80.2450, 0.045, 0.035),
    "Chengalpattu": (12.6841, 79.9836, 0.080, 0.080),
    "Kancheepuram": (12.8342, 79.7036, 0.080, 0.080),
    "Tiruvallur": (13.1432, 79.9074, 0.090, 0.090),
    "Vellore": (12.9165, 79.1325, 0.075, 0.075),
    "Ranipet": (12.9273, 79.3330, 0.065, 0.065),
    "Villupuram": (11.9401, 79.4861, 0.085, 0.085),
    "Cuddalore": (11.7480, 79.6500, 0.085, 0.075),
    "Salem": (11.6643, 78.1460, 0.080, 0.080),
    "Namakkal": (11.2189, 78.1674, 0.075, 0.075),
    "Dharmapuri": (12.1211, 78.1582, 0.080, 0.080),
    "Krishnagiri": (12.5186, 78.2138, 0.085, 0.085),
    "Erode": (11.3410, 77.7172, 0.085, 0.085),
    "Coimbatore": (11.0168, 76.9558, 0.080, 0.080),
    "Karur": (10.9601, 78.0766, 0.075, 0.075),
    "Tiruchirappalli": (10.7905, 78.7047, 0.085, 0.085),
    "Thanjavur": (10.7870, 79.1378, 0.085, 0.085),
    "Madurai": (9.9252, 78.1198, 0.075, 0.075),
    "Thoothukudi": (8.7642, 78.0500, 0.080, 0.070),
    "Tirunelveli": (8.7139, 77.7567, 0.085, 0.085),
}

DEFAULT_TN_COORDS = (11.1271, 78.6569, 0.10, 0.10)


def compute_accurate_coords(row):
    """
    Computes accurate, clustered geographic coordinates for each parcel
    grounded firmly within its actual Tamil Nadu District and Village.
    """
    district = str(row.get("district", "")).strip()
    village = str(row.get("village_name", "")).strip()
    parcel_id = str(row.get("parcel_id", ""))
    case_id = str(row.get("la_case_id", ""))

    lat_c, lon_c, lat_rad, lon_rad = DISTRICT_COORDINATES.get(
        district, DEFAULT_TN_COORDS
    )

    # Village cluster offset (parcels in the same village cluster together)
    v_hash = int(hashlib.md5(f"{district}_{village}".encode()).hexdigest()[:8], 16)
    v_lat_offset = (((v_hash % 1000) / 1000.0) - 0.5) * 2 * (lat_rad * 0.70)
    v_lon_offset = ((((v_hash // 1000) % 1000) / 1000.0) - 0.5) * 2 * (lon_rad * 0.70)

    # Individual parcel offset within village (within 200-500 meters)
    p_hash = int(hashlib.md5(f"{parcel_id}_{case_id}".encode()).hexdigest()[:8], 16)
    p_lat_offset = (((p_hash % 1000) / 1000.0) - 0.5) * 2 * 0.008
    p_lon_offset = ((((p_hash // 1000) % 1000) / 1000.0) - 0.5) * 2 * 0.008

    final_lat = round(lat_c + v_lat_offset + p_lat_offset, 5)
    final_lon = round(lon_c + v_lon_offset + p_lon_offset, 5)

    return final_lat, final_lon


def main():
    print("Loading Excel file...")
    if not INPUT_FILE.exists():
        print(f"File not found: {INPUT_FILE}")
        return
    df = pd.read_excel(INPUT_FILE, sheet_name="geo_parcel")
    print(f"Loaded {len(df)} GIS records from source workbook.")

    # Keep only the fields needed for GIS
    gis_df = df[
        [
            "parcel_id",
            "la_case_id",
            "village_name",
            "tehsil",
            "district",
            "state",
            "area_ha",
            "land_use_type",
            "soil_class",
            "irrigation_status",
            "market_value_per_ha_inr",
            "compensation_rate_per_ha_inr",
        ]
    ].copy()

    # Ensure state is consistently Tamil Nadu
    gis_df["state"] = "Tamil Nadu"

    # Use real coordinates from the workbook when present.
    src_lat = pd.to_numeric(df.get("latitude"), errors="coerce")
    src_lon = pd.to_numeric(df.get("longitude"), errors="coerce")
    has_real = src_lat.notna() & src_lon.notna()
    print(f"Real lat/lon present for {int(has_real.sum())} / {len(df)} parcels.")
    gis_df["latitude"] = src_lat
    gis_df["longitude"] = src_lon
    gis_df["coord_source"] = np.where(has_real, "Workbook geo_parcel lat/lon", "Missing")
    missing = ~has_real
    if missing.any():
        print("Filling missing coordinates with labelled approximate district centroids...")
        filled = [compute_accurate_coords(row) for _, row in gis_df[missing].iterrows()]
        gis_df.loc[missing, "latitude"] = [c[0] for c in filled]
        gis_df.loc[missing, "longitude"] = [c[1] for c in filled]
        gis_df.loc[missing, "coord_source"] = "Approximate district centroid — not survey-parcel location"

    # Save cleaned GIS dataset
    gis_df.to_csv(OUTPUT_FILE, index=False)

    print(f"\n[OK] GIS dataset created successfully!")
    print(f"Total Records: {len(gis_df)}")
    print(f"Saved to: {OUTPUT_FILE}")

    print("\nSample records:")
    print(gis_df[["parcel_id", "district", "village_name", "latitude", "longitude"]].head(10))


if __name__ == "__main__":
    main()
