import pandas as pd
import numpy as np
import joblib
import json

print("=" * 80)
print("UNDERSTANDING THE ML MODEL - STEP BY STEP")
print("=" * 80)

# ============================================================================
# STEP 1: LOAD EVERYTHING
# ============================================================================
print("\n[STEP 1] Loading model and data...")

model = joblib.load('../models/delay_predictor.pkl')
encoders = joblib.load('../models/encoders.pkl')

with open('../models/config.json', 'r') as f:
    config = json.load(f)

df = pd.read_excel(r"D:\SIH\ACQUISIGHT\data\Land_Acquisition_Predictive_Analytics.xlsx")

print("✓ Model loaded")
print("✓ Encoders loaded")
print("✓ Data loaded")

# ============================================================================
# STEP 2: PICK A SAMPLE LAND
# ============================================================================
print("\n" + "=" * 80)
print("[STEP 2] Let's predict for ONE land parcel manually")
print("=" * 80)

# Pick first row as example
sample = df.iloc[0]

print("\n📍 Selected Land:")
print(f"   Land ID: {sample['Land ID']}")
print(f"   District: {sample['District']}")
print(f"   Village: {sample['Village']}")
print(f"   Actual Delay Days: {sample['Delay Days']}")
print(f"   Actual Risk: {sample['Delay Risk']}")

# ============================================================================
# STEP 3: SHOW WHAT MODEL SEES
# ============================================================================
print("\n" + "=" * 80)
print("[STEP 3] What the model sees (features)")
print("=" * 80)

print("\nThe model doesn't see text like 'Chennai' or 'Agricultural'")
print("It only sees NUMBERS! So we convert everything:")

print("\n📊 NUMERICAL FEATURES (already numbers):")
numerical_features = {
    'Area (sq.ft)': sample['Area (sq.ft)'],
    'Soil pH': sample['Soil pH'],
    'No. of Owners': sample['No. of Owners'],
    'No. of Objections': sample['No. of Objections'],
    'Valuation Gap (%)': sample['Valuation Gap (%)']
}

for feat, val in numerical_features.items():
    print(f"   {feat:25} = {val}")

print("\n📊 CATEGORICAL FEATURES (text → numbers):")
print("   (Using Label Encoding)")

categorical_features = {
    'Land Use': sample['Land Use'],
    'Ownership': sample['Ownership'],
    'Flood Risk': sample['Flood Risk'],
    'Water Availability': sample['Water Availability'],
    'Soil Type': sample['Soil Type'],
    'Title Dispute': sample['Title Dispute'],
    'Court Case': sample['Court Case'],
    'Document Status': sample['Document Status'],
    'Acquisition Notice': sample['Acquisition Notice'],
    'Compensation Status': sample['Compensation Status'],
    'Road Access': sample['Road Access']
}

encoded_values = {}

print("\n   Encoding process:")
for feat, value in categorical_features.items():
    encoder_classes = encoders[feat]['classes']
    encoded_value = encoder_classes.index(value)
    encoded_values[feat] = encoded_value
    
    print(f"   {feat:25}: '{value}' → {encoded_value}")
    print(f"      Classes: {encoder_classes}")

# ============================================================================
# STEP 4: BUILD FEATURE VECTOR
# ============================================================================
print("\n" + "=" * 80)
print("[STEP 4] Building the feature vector (what we send to model)")
print("=" * 80)

# Create the feature vector in correct order
feature_vector = {}

# Add numerical
for feat, val in numerical_features.items():
    feature_vector[feat] = val

# Add encoded categorical
for feat, encoded in encoded_values.items():
    feature_vector[feat + '_encoded'] = encoded

print("\nFinal feature vector (16 numbers):")
for i, (feat, val) in enumerate(feature_vector.items(), 1):
    print(f"   {i:2}. {feat:30} = {val}")

# Convert to DataFrame (model expects this format)
X_sample = pd.DataFrame([feature_vector])

print("\n✓ Feature vector ready for prediction!")

# ============================================================================
# STEP 5: MAKE PREDICTION
# ============================================================================
print("\n" + "=" * 80)
print("[STEP 5] Making prediction...")
print("=" * 80)

predicted_days = model.predict(X_sample)[0]

print(f"\n🔮 Model Prediction:")
print(f"   Predicted Delay Days: {predicted_days:.2f}")
print(f"   Actual Delay Days:    {sample['Delay Days']}")
print(f"   Difference:           {abs(predicted_days - sample['Delay Days']):.2f} days")

# Convert to risk category
def days_to_risk(days):
    if days <= 60:
        return 'Low'
    elif days <= 150:
        return 'Medium'
    else:
        return 'High'

predicted_risk = days_to_risk(predicted_days)
actual_risk = sample['Delay Risk']

print(f"\n🎯 Risk Category:")
print(f"   Predicted Risk: {predicted_risk}")
print(f"   Actual Risk:    {actual_risk}")
print(f"   Match: {'✓ CORRECT' if predicted_risk == actual_risk else '✗ WRONG'}")

# ============================================================================
# STEP 6: FEATURE IMPORTANCE
# ============================================================================
print("\n" + "=" * 80)
print("[STEP 6] Which features mattered most for this prediction?")
print("=" * 80)

# Get feature importances from model
importance_df = pd.read_csv('../models/feature_importance.csv')

print("\nTop 5 most important features (globally):")
for i, row in importance_df.head(5).iterrows():
    bar = '█' * int(row['importance'] * 30)
    print(f"   {row['feature']:25} {bar} {row['importance']:.3f}")

# ============================================================================
# STEP 7: HOW RANDOM FOREST WORKS
# ============================================================================
print("\n" + "=" * 80)
print("[STEP 7] Inside the Random Forest (simplified)")
print("=" * 80)

print("""
A Random Forest has many Decision Trees (we have 100).

Each tree asks YES/NO questions like:

Tree 1:
  ┌─ Is Valuation Gap > 15%?
  │   ├─ YES → Is Title Dispute = Yes?
  │   │         ├─ YES → Predict 200 days
  │   │         └─ NO → Predict 120 days
  │   └─ NO → Predict 80 days

Tree 2:
  ┌─ No. of Objections > 3?
  │   ├─ YES → Predict 180 days
  │   └─ NO → Is Court Case = Yes?
  │            ├─ YES → Predict 250 days
  │            └─ NO → Predict 90 days

... (98 more trees)

Final Prediction = Average of all 100 tree predictions
                 = (200 + 120 + 80 + 180 + 250 + 90 + ...) / 100
                 = 121.1 days
""")

print("\n✓ This is why it's called 'Random Forest' - many trees voting!")

# ============================================================================
# STEP 8: TRY ANOTHER EXAMPLE
# ============================================================================
print("\n" + "=" * 80)
print("[STEP 8] Let's try another land parcel")
print("=" * 80)

# Pick a high-risk example
high_risk_sample = df[df['Delay Risk'] == 'High'].iloc[0]

print(f"\n📍 Selected Land:")
print(f"   Land ID: {high_risk_sample['Land ID']}")
print(f"   District: {high_risk_sample['District']}")
print(f"   Title Dispute: {high_risk_sample['Title Dispute']}")
print(f"   Court Case: {high_risk_sample['Court Case']}")
print(f"   Valuation Gap: {high_risk_sample['Valuation Gap (%)']}%")
print(f"   Actual Delay: {high_risk_sample['Delay Days']} days")

# Prepare features
feature_vector_2 = {
    'Area (sq.ft)': high_risk_sample['Area (sq.ft)'],
    'Soil pH': high_risk_sample['Soil pH'],
    'No. of Owners': high_risk_sample['No. of Owners'],
    'No. of Objections': high_risk_sample['No. of Objections'],
    'Valuation Gap (%)': high_risk_sample['Valuation Gap (%)']
}

for feat in categorical_features.keys():
    value = high_risk_sample[feat]
    encoder_classes = encoders[feat]['classes']
    encoded_value = encoder_classes.index(value)
    feature_vector_2[feat + '_encoded'] = encoded_value

X_sample_2 = pd.DataFrame([feature_vector_2])
predicted_days_2 = model.predict(X_sample_2)[0]

print(f"\n🔮 Prediction:")
print(f"   Predicted: {predicted_days_2:.0f} days → {days_to_risk(predicted_days_2)} Risk")
print(f"   Actual:    {high_risk_sample['Delay Days']} days → {high_risk_sample['Delay Risk']} Risk")

print("\n" + "=" * 80)
print("END OF TUTORIAL")
print("=" * 80)