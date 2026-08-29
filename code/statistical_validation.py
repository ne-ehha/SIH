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
        "argo_temperature",
        "model_temperature",
        "temperature_error",
        "argo_salinity",
        "model_salinity",
        "salinity_error",
        "pressure",
        "time",
    ]
)


# ---------------------------------------------------------
# METRIC FUNCTIONS
# ---------------------------------------------------------

def bias(error):
    return float(np.mean(error))


def mae(error):
    return float(np.mean(np.abs(error)))


def rmse(error):
    return float(
        np.sqrt(
            np.mean(error ** 2)
        )
    )


def correlation(observed, modeled):
    if len(observed) < 2:
        return np.nan

    if (
        np.std(observed) == 0
        or np.std(modeled) == 0
    ):
        return np.nan

    return float(
        np.corrcoef(
            observed,
            modeled
        )[0, 1]
    )


def centered_rmse(error):
    return float(
        np.sqrt(
            np.mean(
                (
                    error
                    - np.mean(error)
                ) ** 2
            )
        )
    )


def median_absolute_error(error):
    return float(
        np.median(
            np.abs(error)
        )
    )


def bias_confidence_interval(
    error,
    confidence=0.95
):

    n = len(error)

    mean_error = np.mean(error)

    std_error = (
        np.std(
            error,
            ddof=1
        )
        / np.sqrt(n)
    )

    z = 1.96

    lower = (
        mean_error
        - z * std_error
    )

    upper = (
        mean_error
        + z * std_error
    )

    return (
        float(lower),
        float(upper)
    )


# ---------------------------------------------------------
# OVERALL STATISTICS
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("OVERALL MODEL–OBSERVATION STATISTICS")
print("=" * 60)


temp_error = (
    df["temperature_error"]
    .to_numpy()
)

sal_error = (
    df["salinity_error"]
    .to_numpy()
)


print("\nTEMPERATURE")
print("-" * 40)

print("N:", len(temp_error))

print(
    "Bias:",
    bias(temp_error)
)

print(
    "MAE:",
    mae(temp_error)
)

print(
    "RMSE:",
    rmse(temp_error)
)

print(
    "Std error:",
    float(
        np.std(
            temp_error,
            ddof=1
        )
    )
)

print(
    "Median absolute error:",
    median_absolute_error(
        temp_error
    )
)

print(
    "Correlation:",
    correlation(
        df["argo_temperature"].to_numpy(),
        df["model_temperature"].to_numpy()
    )
)

print(
    "Centered RMSE:",
    centered_rmse(
        temp_error
    )
)

temp_ci = bias_confidence_interval(
    temp_error
)

print(
    "95% bias CI:",
    temp_ci[0],
    "to",
    temp_ci[1]
)


print("\nSALINITY")
print("-" * 40)

print("N:", len(sal_error))

print(
    "Bias:",
    bias(sal_error)
)

print(
    "MAE:",
    mae(sal_error)
)

print(
    "RMSE:",
    rmse(sal_error)
)

print(
    "Std error:",
    float(
        np.std(
            sal_error,
            ddof=1
        )
    )
)

print(
    "Median absolute error:",
    median_absolute_error(
        sal_error
    )
)

print(
    "Correlation:",
    correlation(
        df["argo_salinity"].to_numpy(),
        df["model_salinity"].to_numpy()
    )
)

print(
    "Centered RMSE:",
    centered_rmse(
        sal_error
    )
)

sal_ci = bias_confidence_interval(
    sal_error
)

print(
    "95% bias CI:",
    sal_ci[0],
    "to",
    sal_ci[1]
)


# ---------------------------------------------------------
# DEPTH-STRATIFIED STATISTICS
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("DEPTH-STRATIFIED STATISTICS")
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
    "     T Bias     T RMSE"
    "        T r     S Bias     S RMSE"
)


for label in depth_labels:

    subset = df[
        df["depth_bin"] == label
    ]

    if len(subset) == 0:
        continue

    t_error = (
        subset["temperature_error"]
        .to_numpy()
    )

    s_error = (
        subset["salinity_error"]
        .to_numpy()
    )

    t_r = correlation(
        subset["argo_temperature"].to_numpy(),
        subset["model_temperature"].to_numpy()
    )

    print(
        f"{str(label):<12}"
        f"{len(subset):>6}"
        f"{bias(t_error):>12.3f}"
        f"{rmse(t_error):>11.3f}"
        f"{t_r:>11.3f}"
        f"{bias(s_error):>12.3f}"
        f"{rmse(s_error):>11.3f}"
    )


# ---------------------------------------------------------
# TEMPORAL STATISTICS
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("TEMPORAL STATISTICS")
print("=" * 60)


df["date"] = pd.to_datetime(
    df["time"]
).dt.date


print(
    "\nDate                 N"
    "     T Bias     T RMSE"
    "     S Bias     S RMSE"
)


for date, group in df.groupby(
    "date"
):

    t_error = (
        group["temperature_error"]
        .to_numpy()
    )

    s_error = (
        group["salinity_error"]
        .to_numpy()
    )

    print(
        f"{str(date):<20}"
        f"{len(group):>5}"
        f"{bias(t_error):>12.3f}"
        f"{rmse(t_error):>11.3f}"
        f"{bias(s_error):>12.3f}"
        f"{rmse(s_error):>11.3f}"
    )


# ---------------------------------------------------------
# OUTLIER SENSITIVITY
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("OUTLIER SENSITIVITY")
print("=" * 60)


temp_mask = (
    np.abs(temp_error)
    > 2
)

sal_mask = (
    np.abs(sal_error)
    > 1
)


temp_clean = temp_error[
    ~temp_mask
]

sal_clean = sal_error[
    ~sal_mask
]


print("\nTemperature:")

print(
    "Extreme observations:",
    int(temp_mask.sum())
)

print(
    "Percentage:",
    float(
        temp_mask.mean() * 100
    )
)


print("\nSalinity:")

print(
    "Extreme observations:",
    int(sal_mask.sum())
)

print(
    "Percentage:",
    float(
        sal_mask.mean() * 100
    )
)


print("\nTemperature RMSE:")

print(
    "All:",
    rmse(temp_error)
)

print(
    "Without |error| > 2°C:",
    rmse(temp_clean)
)


print("\nSalinity RMSE:")

print(
    "All:",
    rmse(sal_error)
)

print(
    "Without |error| > 1 PSU:",
    rmse(sal_clean)
)


# ---------------------------------------------------------
# DEPTH STRUCTURE CHECK
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("DEPTH STRUCTURE CHECK")
print("=" * 60)


depth = (
    df["pressure"]
    .to_numpy()
)


if (
    np.std(depth) > 0
    and np.std(temp_error) > 0
):

    depth_temp_corr = float(
        np.corrcoef(
            depth,
            temp_error
        )[0, 1]
    )

else:

    depth_temp_corr = np.nan


if (
    np.std(depth) > 0
    and np.std(sal_error) > 0
):

    depth_sal_corr = float(
        np.corrcoef(
            depth,
            sal_error
        )[0, 1]
    )

else:

    depth_sal_corr = np.nan


print(
    "\nOverall depth vs temperature error:",
    depth_temp_corr
)

print(
    "Overall depth vs salinity error:",
    depth_sal_corr
)


print("\nNote:")

print(
    """
Overall correlations are descriptive only.

A weak overall depth correlation does not rule out
layer-specific patterns.

The statistics quantify model–observation differences;
they do not establish the physical cause of those
differences.
"""
)


print(
    "\nEnhanced statistical validation complete."
)