import pandas as pd

df = pd.read_excel(r"D:\SIH\ACQUISIGHT\data\Land_Acquisition_Predictive_Analytics.xlsx")

print("=" * 70)
print("CHECKING: Is Delay Risk derived from Delay Days?")
print("=" * 70)

# Group by Delay Risk and show Delay Days statistics
print("\nDelay Days statistics by Delay Risk category:\n")
grouped = df.groupby('Delay Risk')['Delay Days'].agg(['min', 'max', 'mean', 'count'])
print(grouped)

print("\n" + "=" * 70)
print("DETAILED VIEW: Delay Days → Delay Risk mapping")
print("=" * 70)

# Show all unique combinations
for risk in ['Low', 'Medium', 'High']:
    subset = df[df['Delay Risk'] == risk]['Delay Days']
    print(f"\n{risk} Risk: Delay Days range = {subset.min()} to {subset.max()} (n={len(subset)})")

print("\n" + "=" * 70)
print("RECOMMENDATION")
print("=" * 70)

# Check if there's a clear threshold pattern
low_max = df[df['Delay Risk'] == 'Low']['Delay Days'].max()
medium_min = df[df['Delay Risk'] == 'Medium']['Delay Days'].min()
medium_max = df[df['Delay Risk'] == 'Medium']['Delay Days'].max()
high_min = df[df['Delay Risk'] == 'High']['Delay Days'].min()

print(f"\nObserved thresholds:")
print(f"  Low:    {df[df['Delay Risk'] == 'Low']['Delay Days'].min()} - {low_max} days")
print(f"  Medium: {medium_min} - {medium_max} days")
print(f"  High:   {high_min} - {df[df['Delay Risk'] == 'High']['Delay Days'].max()} days")

print("\n💡 CONCLUSION:")
if low_max < medium_min and medium_max < high_min:
    print("Delay Risk is LIKELY rule-based from Delay Days!")
    print("→ We should PREDICT DELAY DAYS first, then convert to Risk")
else:
    print("Delay Risk may use additional factors beyond just Delay Days")
    print("→ We can try ML on Delay Risk directly")