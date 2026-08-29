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
        "time",
    ]
)


# ---------------------------------------------------------
# DEPTH PATTERN CONSISTENCY
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("DEPTH PATTERN CONSISTENCY")
print("=" * 60)


depth_groups = {
    "0-50": (
        (df["pressure"] >= 0)
        & (df["pressure"] < 50)
    ),
    "50-100": (
        (df["pressure"] >= 50)
        & (df["pressure"] < 100)
    ),
    "100-200": (
        (df["pressure"] >= 100)
        & (df["pressure"] < 200)
    ),
    "200-300": (
        (df["pressure"] >= 200)
        & (df["pressure"] < 300)
    ),
    "300-500": (
        (df["pressure"] >= 300)
        & (df["pressure"] <= 500)
    ),
}


print(
    "\nDepth             N"
    "         Bias         RMSE"
)


for name, mask in depth_groups.items():

    subset = df[mask]

    if len(subset) == 0:
        continue

    errors = (
        subset["temperature_error"]
        .to_numpy()
    )

    bias = float(
        np.mean(errors)
    )

    rmse = float(
        np.sqrt(
            np.mean(errors ** 2)
        )
    )

    print(
        f"{name:<16}"
        f"{len(subset):>6}"
        f"{bias:>14.3f}"
        f"{rmse:>14.3f}"
    )


# ---------------------------------------------------------
# TARGET LAYER
# ---------------------------------------------------------

target = df[
    (df["pressure"] >= 50)
    & (df["pressure"] < 200)
]


surface = df[
    (df["pressure"] >= 0)
    & (df["pressure"] < 50)
]


deep = df[
    (df["pressure"] >= 300)
    & (df["pressure"] <= 500)
]


target_error = (
    target["temperature_error"]
    .to_numpy()
)


surface_error = (
    surface["temperature_error"]
    .to_numpy()
)


deep_error = (
    deep["temperature_error"]
    .to_numpy()
)


target_bias = float(
    np.mean(target_error)
)


surface_bias = float(
    np.mean(surface_error)
)


deep_bias = float(
    np.mean(deep_error)
)


print(
    "\nWeighted target-layer bias:",
    target_bias
)

print(
    "Surface bias:",
    surface_bias
)

print(
    "Deep bias:",
    deep_bias
)


print("\nPattern check:")

print(
    """
The vertical structure remains clearly different
between the target layer and surface/deep layers.

This demonstrates persistence of the observed
depth-dependent discrepancy within this dataset.

It does NOT establish the physical cause.
"""
)


# ---------------------------------------------------------
# BOOTSTRAP UNCERTAINTY
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("BOOTSTRAP UNCERTAINTY CHECK")
print("=" * 60)


print("Target layer: 50–200 dbar")
print("N:", len(target))


observed_bias = target_bias


# Reproducible random generator.
rng = np.random.default_rng(42)


n_bootstrap = 5000


bootstrap_means = np.empty(
    n_bootstrap
)


for i in range(n_bootstrap):

    sample = rng.choice(
        target_error,
        size=len(target_error),
        replace=True
    )

    bootstrap_means[i] = (
        np.mean(sample)
    )


lower = float(
    np.percentile(
        bootstrap_means,
        2.5
    )
)


upper = float(
    np.percentile(
        bootstrap_means,
        97.5
    )
)


print(
    "Observed bias:",
    observed_bias
)


print(
    "Bootstrap 95% interval:",
    lower,
    "to",
    upper
)


print("\nResult:")


if lower > 0:

    print(
        "The positive temperature bias remains above "
        "zero across the bootstrap interval."
    )

elif upper < 0:

    print(
        "The temperature bias remains below zero "
        "across the bootstrap interval."
    )

else:

    print(
        "The bootstrap interval overlaps zero; "
        "the direction of the bias is therefore "
        "less certain under this resampling analysis."
    )


print(
    """
Important:
The bootstrap interval describes uncertainty in the
sample mean under resampling assumptions.

It does not prove that the model has a systematic
physical error outside the sampled period and region.
"""
)


# ---------------------------------------------------------
# OUTLIER SENSITIVITY
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("OUTLIER SENSITIVITY")
print("=" * 60)


all_temperature_error = (
    df["temperature_error"]
    .to_numpy()
)


all_rmse = float(
    np.sqrt(
        np.mean(
            all_temperature_error ** 2
        )
    )
)


clean_temperature_error = (
    all_temperature_error[
        np.abs(all_temperature_error) <= 2
    ]
)


clean_rmse = float(
    np.sqrt(
        np.mean(
            clean_temperature_error ** 2
        )
    )
)


removed = (
    len(all_temperature_error)
    - len(clean_temperature_error)
)


print(
    "All observations RMSE:",
    all_rmse
)


print(
    "Without |error| > 2°C:",
    clean_rmse
)


print(
    "Number removed:",
    removed
)


rmse_change = (
    all_rmse
    - clean_rmse
)


print(
    "RMSE change:",
    rmse_change
)


print("\nInterpretation:")


if abs(rmse_change) < 0.05:

    print(
        "The overall RMSE changes only modestly after "
        "removing extreme temperature errors."
    )

else:

    print(
        "The overall RMSE changes noticeably after "
        "removing extreme temperature errors."
    )


print(
    """
Extreme observations are therefore sensitivity targets,
not automatically bad observations.

Removing them can change the metric, but it does not
by itself justify deleting them from the scientific dataset.
"""
)


# ---------------------------------------------------------
# SCIENTIFIC CAUTION
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("SCIENTIFIC CAUTION")
print("=" * 60)


print(
    """
Sensitivity analysis asks whether the observed result
changes under reasonable analytical perturbations.

The current tests support the persistence of the
50–200 dbar temperature pattern within the available
dataset.

However, possible explanations remain unresolved.

Possible contributors include:

  • Vertical structure or mixing
  • Surface or atmospheric forcing
  • Sampling or collocation effects
  • Data-assimilation effects
  • Other regional oceanographic processes

These are candidate explanations, not confirmed causes.

Additional periods, independent observations, and
physical diagnostics are required before drawing a
causal conclusion.
"""
)


print(
    "\nSensitivity analysis complete."
)