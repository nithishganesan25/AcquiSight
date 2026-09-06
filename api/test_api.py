import requests
import json

# Test data (based on your Excel data)
test_land = {
    "land_id": "LND001",
    "area_sqft": 22152,
    "soil_ph": 7.2,
    "no_of_owners": 2,
    "no_of_objections": 3,
    "valuation_gap_percent": 13,
    "land_use": "Agricultural",
    "ownership": "Individual",
    "flood_risk": "Medium",
    "water_availability": "Medium",
    "soil_type": "Alluvial",
    "title_dispute": "No",
    "court_case": "No",
    "document_status": "Complete",
    "acquisition_notice": "Issued",
    "compensation_status": "Approved",
    "road_access": "Good"
}

print("=" * 70)
print("TESTING PREDICTION API")
print("=" * 70)

try:
    # Make prediction
    response = requests.post("http://localhost:8000/predict", json=test_land)
    
    if response.status_code == 200:
        result = response.json()
        print("\n✓ Prediction successful!")
        print("\n" + json.dumps(result, indent=2))
    else:
        print(f"\n✗ Error: {response.status_code}")
        print(response.text)
        
except Exception as e:
    print(f"\n✗ Connection error: {e}")
    print("Make sure API server is running: python api/main.py")