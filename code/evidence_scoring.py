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
    ]
)


# ---------------------------------------------------------
# EVIDENCE CLASSIFICATION
# ---------------------------------------------------------

def classify_evidence(
    n,
    bias,
    weak_threshold=0.10,
    moderate_threshold=0.20,
    strong_threshold=0.50,
):
    """
    Classify the strength of a pattern using both
    sample size and magnitude of bias.

    This is an exploratory evidence-ranking scheme.
    It is NOT a formal statistical significance test.
    """

    absolute_bias = abs(bias)

    if n < 20:
        return "WEAK"

    if absolute_bias >= strong_threshold:
        return "STRONG"

    if absolute_bias >= moderate_threshold:
        return "MODERATE"

    return "WEAK"


# ---------------------------------------------------------
# TEMPERATURE DEPTH EVIDENCE
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("TEMPERATURE DEPTH EVIDENCE")
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
    "\nDepth             N"
    "       Bias       RMSE     Evidence"
)


for label in depth_labels:

    subset = df[
        df["depth_bin"] == label
    ]

    if len(subset) == 0:
        continue

    error = (
        subset["temperature_error"]
        .to_numpy()
    )

    n = len(error)

    mean_bias = float(
        np.mean(error)
    )

    rmse = float(
        np.sqrt(
            np.mean(error ** 2)
        )
    )

    evidence = classify_evidence(
        n,
        mean_bias
    )

    print(
        f"{str(label):<14}"
        f"{n:>6}"
        f"{mean_bias:>12.3f}"
        f"{rmse:>11.3f}"
        f"{evidence:>13}"
    )


# ---------------------------------------------------------
# SALINITY SPATIAL EVIDENCE
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("SALINITY SPATIAL EVIDENCE")
print("=" * 60)


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


spatial["evidence"] = spatial.apply(
    lambda row: classify_evidence(
        int(row["n"]),
        float(row["salinity_bias"]),
        weak_threshold=0.10,
        moderate_threshold=0.20,
        strong_threshold=1.00,
    ),
    axis=1
)


spatial = (
    spatial
    .sort_values(
        "salinity_bias",
        key=lambda x: np.abs(x),
        ascending=False
    )
    .head(10)
)


print(
    "\nLat      Lon           N"
    "       Bias     Evidence"
)


for _, row in spatial.iterrows():

    print(
        f"{row['latitude_cell']:<8.1f}"
        f"{row['longitude_cell']:<12.1f}"
        f"{int(row['n']):>5}"
        f"{row['salinity_bias']:>12.3f}"
        f"{row['evidence']:>13}"
    )


# ---------------------------------------------------------
# OUTLIER EVIDENCE
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("OUTLIER EVIDENCE")
print("=" * 60)


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


temperature_count = int(
    temperature_outliers.sum()
)


salinity_count = int(
    salinity_outliers.sum()
)


temperature_percentage = (
    temperature_count
    / len(df)
    * 100
)


salinity_percentage = (
    salinity_count
    / len(df)
    * 100
)


print(
    "\nTemperature extreme observations:",
    temperature_count
)

print(
    "Temperature percentage:",
    f"{temperature_percentage:.2f}%"
)


print(
    "\nSalinity extreme observations:",
    salinity_count
)

print(
    "Salinity percentage:",
    f"{salinity_percentage:.2f}%"
)


# ---------------------------------------------------------
# SCIENTIFIC INTERPRETATION
# ---------------------------------------------------------

print("\nInterpretation:")

print(
    """
Evidence labels are exploratory rankings based on
sample size and discrepancy magnitude.

They are NOT formal proof of statistical significance.

Strong or moderate evidence indicates a pattern
worth investigating further.

Extreme observations are investigation targets,
not automatic bad-data flags.

Most importantly, evidence of a model–observation
discrepancy does not establish its physical cause.
Possible causes must be tested independently.
"""
)


print(
    "\nEvidence scoring complete."
)