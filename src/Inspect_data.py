import pandas as pd
import numpy as np

# Load the Excel file
print("=" * 60)
print("STEP 1: LOADING DATA")
print("=" * 60)

df = pd.read_excel(r"D:\SIH\ACQUISIGHT\data\Land_Acquisition_Predictive_Analytics.xlsx")

print(f"\n✓ Successfully loaded data!")
print(f"Total rows: {len(df)}")
print(f"Total columns: {len(df.columns)}")

print("\n" + "=" * 60)
print("STEP 2: COLUMN NAMES")
print("=" * 60)
print("\nAll columns in dataset:")
for i, col in enumerate(df.columns, 1):
    print(f"{i}. {col}")

print("\n" + "=" * 60)
print("STEP 3: DATA TYPES")
print("=" * 60)
print("\nColumn data types:")
print(df.dtypes)

print("\n" + "=" * 60)
print("STEP 4: FIRST 10 ROWS")
print("=" * 60)
print("\nSample data:")
print(df.head(10))

print("\n" + "=" * 60)
print("STEP 5: MISSING VALUES CHECK")
print("=" * 60)
print("\nMissing values per column:")
missing = df.isnull().sum()
print(missing[missing > 0] if any(missing > 0) else "✓ No missing values!")

print("\n" + "=" * 60)
print("STEP 6: DUPLICATE ROWS CHECK")
print("=" * 60)
duplicates = df.duplicated().sum()
print(f"Duplicate rows: {duplicates}")

print("\n" + "=" * 60)
print("STEP 7: TARGET COLUMN ANALYSIS (Delay Risk)")
print("=" * 60)

if 'Delay Risk' in df.columns:
    print("\nDelay Risk value counts:")
    print(df['Delay Risk'].value_counts())
    print(f"\nUnique values: {df['Delay Risk'].unique()}")
else:
    print("⚠ 'Delay Risk' column NOT found!")

print("\n" + "=" * 60)
print("STEP 8: DELAY DAYS ANALYSIS")
print("=" * 60)

if 'Delay Days' in df.columns:
    print(f"\nDelay Days statistics:")
    print(df['Delay Days'].describe())
    print(f"\nMin: {df['Delay Days'].min()}")
    print(f"Max: {df['Delay Days'].max()}")
    print(f"Mean: {df['Delay Days'].mean():.2f}")
else:
    print("⚠ 'Delay Days' column NOT found!")

print("\n" + "=" * 60)
print("STEP 9: CATEGORICAL VS NUMERICAL COLUMNS")
print("=" * 60)

categorical_cols = df.select_dtypes(include=['object']).columns.tolist()
numerical_cols = df.select_dtypes(include=['int64', 'float64']).columns.tolist()

print(f"\nCategorical columns ({len(categorical_cols)}):")
for col in categorical_cols:
    print(f"  - {col}: {df[col].nunique()} unique values")

print(f"\nNumerical columns ({len(numerical_cols)}):")
for col in numerical_cols:
    print(f"  - {col}: range [{df[col].min()}, {df[col].max()}]")

print("\n" + "=" * 60)
print("STEP 10: CRITICAL QUESTIONS FOR ML")
print("=" * 60)

print("\n❓ Is 'Delay Risk' already manually assigned?")
print("   → Check if values look handcrafted (e.g., pattern-based)")

print("\n❓ Do we have enough rows for ML?")
print(f"   → Current rows: {len(df)}")
print("   → Rule of thumb: Need at least 50-100 rows per class for decent ML")

print("\n❓ Should we use 'Delay Days' as input or target?")
print("   → If 'Delay Risk' is derived from 'Delay Days', we might predict Days instead")

print("\n" + "=" * 60)
print("INSPECTION COMPLETE")
print("=" * 60)