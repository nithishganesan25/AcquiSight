from pathlib import Path
import hashlib
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent
GIS_DATA_FILE = BASE_DIR / "data" / "gis_parcels.csv"
SCORED_LAND_FILE = BASE_DIR / "data" / "land_records_scored.csv"
CLEANED_LAND_FILE = BASE_DIR / "data" / "cleaned_land_records.csv"

# District centroids for APPROXIMATE village-level display only.
DISTRICT_COORDINATES = {
    "Chennai": (13.0827, 80.2707),
    "Chengalpattu": (12.6841, 79.9836),
    "Kancheepuram": (12.8342, 79.7036),
    "Tiruvallur": (13.1432, 79.9074),
    "Vellore": (12.9165, 79.1325),
    "Ranipet": (12.9273, 79.3330),
    "Villupuram": (11.9401, 79.4861),
    "Cuddalore": (11.7480, 79.7714),
    "Salem": (11.6643, 78.1460),
    "Namakkal": (11.2189, 78.1674),
    "Dharmapuri": (12.1211, 78.1582),
    "Krishnagiri": (12.5186, 78.2138),
    "Erode": (11.3410, 77.7172),
    "Coimbatore": (11.0168, 76.9558),
    "Tiruppur": (11.1085, 77.3411),
    "Karur": (10.9601, 78.0766),
    "Tiruchirappalli": (10.7905, 78.7047),
    "Thanjavur": (10.7870, 79.1378),
    "Madurai": (9.9252, 78.1198),
    "Dindigul": (10.3673, 77.9803),
    "Thoothukudi": (8.7642, 78.1348),
    "Tirunelveli": (8.7139, 77.7567),
}
DEFAULT_TN = (11.1271, 78.6569)


def approximate_village_point(district: str, village: str, land_id: str) -> tuple[float, float]:
    """
    Stable jitter around the district centroid.
    This is NOT a survey-parcel coordinate.
    """
    lat0, lon0 = DISTRICT_COORDINATES.get(str(district).strip(), DEFAULT_TN)
    seed = f"{district}|{village}|{land_id}".encode("utf-8")
    h = int(hashlib.md5(seed).hexdigest()[:8], 16)
    dlat = (((h % 1000) / 1000.0) - 0.5) * 0.18
    dlon = ((((h // 1000) % 1000) / 1000.0) - 0.5) * 0.18
    return round(lat0 + dlat, 5), round(lon0 + dlon, 5)


def attach_approx_coords(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    coords = [
        approximate_village_point(
            row.get("District", ""),
            row.get("Village", ""),
            row.get("Land_ID", i),
        )
        for i, row in out.iterrows()
    ]
    out["latitude"] = [c[0] for c in coords]
    out["longitude"] = [c[1] for c in coords]
    out["coord_source"] = "Approximate district/village centroid — not survey-parcel location"
    return out


def load_gis_data():
    path = SCORED_LAND_FILE if SCORED_LAND_FILE.exists() else CLEANED_LAND_FILE
    if not path.exists() and GIS_DATA_FILE.exists():
        df = pd.read_csv(GIS_DATA_FILE)
        df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
        df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
        return df.dropna(subset=["latitude", "longitude"]).copy()
    if not path.exists():
        raise FileNotFoundError(f"GIS land records not found: {path}")
    df = pd.read_csv(path)
    if "latitude" not in df.columns or df["latitude"].isna().all():
        df = attach_approx_coords(df)
    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
    return df.dropna(subset=["latitude", "longitude"]).copy()


def get_gis_summary(df):
    return {
        "total_parcels": len(df),
        "districts": int(df["District"].nunique()) if "District" in df.columns else int(df.get("district", pd.Series()).nunique()),
        "villages": int(df["Village"].nunique()) if "Village" in df.columns else 0,
    }
