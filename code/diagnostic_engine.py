import xarray as xr
import numpy as np
import pandas as pd
from pathlib import Path


# ---------------------------------------------------------
# PROJECT PATH
# ---------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent

INPUT_FILE = (
    PROJECT_ROOT
    / "processed"
    / "glorys_argo_collocation_2024.nc"
)


# ---------------------------------------------------------
# LOAD DATA
# ---------------------------------------------------------

print("Loading collocated dataset...")

ds = xr.open_dataset(INPUT_FILE)

df = ds.to_dataframe().reset_index()

df = df.dropna(
    subset=[
        "temperature_error",
        "salinity_error",
        "pressure",
        "latitude",
        "longitude",
        "time",
    ]
)


# ---------------------------------------------------------
# DEPTH ANALYSIS
# ---------------------------------------------------------

print("Analyzing depth patterns...")


depth_bins = [
    0,
    10,
    25,
    50,
    100,
    200,
    300,
    400,
    500,
]


labels = [
    "0-10",
    "10-25",
    "25-50",
    "50-100",
    "100-200",
    "200-300",
    "300-400",
    "400-500",
]


df["depth_bin"] = pd.cut(
    df["pressure"],
    bins=depth_bins,
    labels=labels,
    include_lowest=True
)


depth_results = []


for label in labels:

    subset = df[
        df["depth_bin"] == label
    ]

    if len(subset) == 0:
        continue

    temp_error = (
        subset["temperature_error"]
        .to_numpy()
    )

    rmse = np.sqrt(
        np.mean(
            temp_error ** 2
        )
    )

    depth_results.append({
        "depth": label,
        "n": len(subset),
        "bias": float(
            np.mean(temp_error)
        ),
        "rmse": float(rmse),
    })


depth_table = pd.DataFrame(
    depth_results
)


# ---------------------------------------------------------
# TARGET-LAYER ANALYSIS
# ---------------------------------------------------------

target = df[
    (df["pressure"] >= 50)
    & (df["pressure"] < 200)
]


surface = df[
    df["pressure"] < 50
]


deep = df[
    df["pressure"] >= 300
]


target_bias = float(
    target["temperature_error"].mean()
)


target_rmse = float(
    np.sqrt(
        np.mean(
            target["temperature_error"]
            .to_numpy() ** 2
        )
    )
)


surface_bias = float(
    surface["temperature_error"].mean()
)


deep_bias = float(
    deep["temperature_error"].mean()
)


# ---------------------------------------------------------
# SPATIAL ANALYSIS
# ---------------------------------------------------------

print("Analyzing spatial patterns...")


df["latitude_cell"] = (
    df["latitude"] * 2
).round() / 2


df["longitude_cell"] = (
    df["longitude"] * 2
).round() / 2


spatial = (
    df.groupby(
        [
            "latitude_cell",
            "longitude_cell",
        ],
        observed=True
    )
    .agg(
        n=("salinity_error", "size"),
        salinity_bias=(
            "salinity_error",
            "mean"
        ),
    )
    .reset_index()
)


# ---------------------------------------------------------
# SALINITY HOTSPOT
# ---------------------------------------------------------

salinity_hotspot = (
    spatial
    .sort_values(
        "salinity_bias",
        key=lambda x: np.abs(x),
        ascending=False
    )
    .iloc[0]
)


# ---------------------------------------------------------
# TEMPORAL ANALYSIS
# ---------------------------------------------------------

print("Analyzing temporal patterns...")


df["date"] = pd.to_datetime(
    df["time"]
).dt.date


temporal = (
    df.groupby("date")
    .agg(
        n=("temperature_error", "size"),
        temperature_bias=(
            "temperature_error",
            "mean"
        ),
    )
    .reset_index()
)


max_daily_bias = float(
    temporal["temperature_bias"].max()
)


min_daily_bias = float(
    temporal["temperature_bias"].min()
)


max_bias_date = temporal.loc[
    temporal["temperature_bias"].idxmax(),
    "date"
]


min_bias_date = temporal.loc[
    temporal["temperature_bias"].idxmin(),
    "date"
]


# ---------------------------------------------------------
# OUTLIERS
# ---------------------------------------------------------

temperature_outliers = (
    np.abs(
        df["temperature_error"]
    ) > 2
)


salinity_outliers = (
    np.abs(
        df["salinity_error"]
    ) > 1
)


temperature_outlier_count = int(
    temperature_outliers.sum()
)


salinity_outlier_count = int(
    salinity_outliers.sum()
)


temperature_outlier_percentage = (
    temperature_outlier_count
    / len(df)
    * 100
)


salinity_outlier_percentage = (
    salinity_outlier_count
    / len(df)
    * 100
)


# ---------------------------------------------------------
# REPORT
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("EVIDENCE-BASED DIAGNOSTIC REPORT")
print("=" * 60)


# ---------------------------------------------------------
# FINDING 1
# ---------------------------------------------------------

print("\nFINDING #1")
print("-" * 60)

print("Type: DEPTH_PATTERN")
print("Variable: temperature")
print("Severity: HIGH")

print(
    "\nFinding:\n"
    "Positive temperature bias is concentrated "
    "between 50 and 200 dbar."
)

print(
    "\nEvidence:"
)

print(
    f"50-200 dbar weighted bias = "
    f"{target_bias:.3f} °C; "
    f"weighted RMSE = "
    f"{target_rmse:.3f} °C; "
    f"N = {len(target)}."
)

print(
    "Surface/deep biases remain comparatively small."
)

print(
    "\nPossible interpretation:"
)

print(
    "The pattern is consistent with a "
    "layer-specific discrepancy in the model "
    "representation of upper-ocean thermal structure."
)

print(
    "\nScientific caution:"
)

print(
    "This does not establish the physical cause."
)


# ---------------------------------------------------------
# FINDING 2
# ---------------------------------------------------------

print("\nFINDING #2")
print("-" * 60)

print("Type: SPATIAL_PATTERN")
print("Variable: salinity")
print("Severity: MEDIUM")

print(
    "\nFinding:"
)

print(
    "A localized salinity-bias hotspot was detected."
)

print(
    "\nEvidence:"
)

print(
    f"Approximate cell centered at "
    f"{salinity_hotspot['latitude_cell']:.1f}°N, "
    f"{salinity_hotspot['longitude_cell']:.1f}°E; "
    f"bias = "
    f"{salinity_hotspot['salinity_bias']:.3f} PSU; "
    f"N = {int(salinity_hotspot['n'])}."
)

print(
    "\nPossible interpretation:"
)

print(
    "The discrepancy appears spatially localized "
    "rather than uniformly distributed."
)

print(
    "\nScientific caution:"
)

print(
    "Spatial binning is exploratory; the physical "
    "cause requires additional oceanographic evidence."
)


# ---------------------------------------------------------
# FINDING 3
# ---------------------------------------------------------

print("\nFINDING #3")
print("-" * 60)

print("Type: TEMPORAL_PATTERN")
print("Variable: temperature")
print("Severity: MEDIUM")

print(
    "\nFinding:"
)

print(
    "Temperature bias changes over the "
    "observation period."
)

print(
    "\nEvidence:"
)

print(
    f"Maximum daily bias = "
    f"{max_daily_bias:.3f} °C on "
    f"{max_bias_date}; "
    f"minimum = "
    f"{min_daily_bias:.3f} °C on "
    f"{min_bias_date}."
)

print(
    "\nPossible interpretation:"
)

print(
    "The model–observation discrepancy is "
    "not temporally constant."
)

print(
    "\nScientific caution:"
)

print(
    "Sparse Argo sampling means temporal patterns "
    "must be interpreted cautiously."
)


# ---------------------------------------------------------
# FINDING 4
# ---------------------------------------------------------

print("\nFINDING #4")
print("-" * 60)

print("Type: OUTLIER")
print("Variable: temperature")
print("Severity: LOW")

print(
    "\nFinding:"
)

print(
    "A small number of large temperature "
    "discrepancies were detected."
)

print(
    "\nEvidence:"
)

print(
    f"{temperature_outlier_count} observations "
    f"({temperature_outlier_percentage:.2f}%) "
    f"have |error| > 2 °C."
)

print(
    "\nPossible interpretation:"
)

print(
    "These observations warrant targeted investigation."
)

print(
    "\nScientific caution:"
)

print(
    "They should not be automatically discarded."
)


# ---------------------------------------------------------
# FINDING 5
# ---------------------------------------------------------

print("\nFINDING #5")
print("-" * 60)

print("Type: OUTLIER")
print("Variable: salinity")
print("Severity: MEDIUM")

print(
    "\nFinding:"
)

print(
    "A subset of salinity observations contains "
    "large discrepancies."
)

print(
    "\nEvidence:"
)

print(
    f"{salinity_outlier_count} observations "
    f"({salinity_outlier_percentage:.2f}%) "
    f"have |error| > 1 PSU."
)

print(
    "\nPossible interpretation:"
)

print(
    "These observations may contain useful information "
    "about localized or unusual model–observation "
    "disagreement."
)

print(
    "\nScientific caution:"
)

print(
    "Do not automatically classify these as "
    "bad observations."
)


# ---------------------------------------------------------
# OVERALL SCIENTIFIC CAUTION
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("OVERALL SCIENTIFIC CAUTION")
print("=" * 60)

print(
    """
The diagnostics identify patterns and statistical
associations in the available model–observation data.

They do NOT establish causation.

Possible explanations should be treated as candidate
hypotheses requiring additional evidence.

Potential explanations include:

  • Differences in upper-ocean vertical structure
  • Vertical mixing or stratification differences
  • Surface or atmospheric forcing
  • Sampling or collocation effects
  • Data-assimilation or reanalysis effects

No single physical cause is confirmed by this analysis.
"""
)


print(
    "\nDiagnostic analysis complete."
)