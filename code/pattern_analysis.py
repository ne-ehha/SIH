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

print("Loading collocated data...")

ds = xr.open_dataset(INPUT_FILE)

df = ds.to_dataframe().reset_index()

# Remove rows with missing values needed for analysis.
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
# DEPTH-DEPENDENT ERROR ANALYSIS
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("DEPTH-DEPENDENT ERROR ANALYSIS")
print("=" * 60)


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

depth_labels = [
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
    labels=depth_labels,
    include_lowest=True
)


print(
    "\nDepth                  N    Temp bias     Sal bias"
)


for label in depth_labels:

    subset = df[
        df["depth_bin"] == label
    ]

    if len(subset) == 0:
        continue

    temp_bias = subset[
        "temperature_error"
    ].mean()

    sal_bias = subset[
        "salinity_error"
    ].mean()

    print(
        f"{str(label):<18}"
        f"{len(subset):>5}"
        f"{temp_bias:>13.3f}"
        f"{sal_bias:>13.3f}"
    )


# ---------------------------------------------------------
# SPATIAL ERROR ANALYSIS
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("SPATIAL ERROR ANALYSIS")
print("=" * 60)


# Round locations into approximately 0.5-degree cells.
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
        n=("temperature_error", "size"),
        temperature_bias=(
            "temperature_error",
            "mean"
        ),
        salinity_bias=(
            "salinity_error",
            "mean"
        ),
    )
    .reset_index()
)


# ---------------------------------------------------------
# TEMPERATURE HOTSPOTS
# ---------------------------------------------------------

print("\nLargest temperature-bias cells:")

largest_temperature = (
    spatial
    .sort_values(
        "temperature_bias",
        ascending=False
    )
    .head(10)
)


print(
    largest_temperature[
        [
            "latitude_cell",
            "longitude_cell",
            "n",
            "temperature_bias",
        ]
    ].to_string(index=False)
)


# ---------------------------------------------------------
# SALINITY HOTSPOTS
# ---------------------------------------------------------

print("\nLargest salinity-bias cells:")

largest_salinity = (
    spatial
    .sort_values(
        "salinity_bias",
        key=lambda x: np.abs(x),
        ascending=False
    )
    .head(10)
)


print(
    largest_salinity[
        [
            "latitude_cell",
            "longitude_cell",
            "n",
            "salinity_bias",
        ]
    ].to_string(index=False)
)


# ---------------------------------------------------------
# TEMPORAL ERROR ANALYSIS
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("TEMPORAL ERROR ANALYSIS")
print("=" * 60)


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
        salinity_bias=(
            "salinity_error",
            "mean"
        ),
    )
    .reset_index()
)


print(
    "\nDate                   N    Temp bias     Sal bias"
)


for _, row in temporal.iterrows():

    print(
        f"{str(row['date']):<20}"
        f"{int(row['n']):>5}"
        f"{row['temperature_bias']:>13.3f}"
        f"{row['salinity_bias']:>13.3f}"
    )


# ---------------------------------------------------------
# OUTLIER ANALYSIS
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("OUTLIER ANALYSIS")
print("=" * 60)


temperature_outliers = (
    np.abs(df["temperature_error"])
    > 2
)

salinity_outliers = (
    np.abs(df["salinity_error"])
    > 1
)


print(
    "\nTemperature |error| > 2°C:",
    int(temperature_outliers.sum())
)

print(
    "Salinity |error| > 1 PSU:",
    int(salinity_outliers.sum())
)


# ---------------------------------------------------------
# SCIENTIFIC CAUTION
# ---------------------------------------------------------

print("\nImportant:")

print(
    """
These patterns identify possible spatial, temporal,
and depth-dependent discrepancies.

They do NOT establish a physical cause.

Observed hotspots or outliers should be investigated
rather than automatically removed or interpreted as
model failure.
"""
)


print("\nPattern analysis complete.")