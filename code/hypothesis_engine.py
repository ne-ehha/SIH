import xarray as xr
import numpy as np
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


# ---------------------------------------------------------
# CONVERT TO DATAFRAME
# ---------------------------------------------------------

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
# UPPER-OCEAN TEMPERATURE HYPOTHESIS
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

surface_bias = float(
    surface["temperature_error"].mean()
)

deep_bias = float(
    deep["temperature_error"].mean()
)


# ---------------------------------------------------------
# SALINITY SPATIAL HYPOTHESIS
# ---------------------------------------------------------

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


# ---------------------------------------------------------
# REPORT
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("HYPOTHESIS & EVIDENCE REPORT")
print("=" * 60)


# =========================================================
# HYPOTHESIS 1
# =========================================================

print("\nPossible upper-ocean vertical-structure discrepancy")
print("-" * 60)


print(
    "\nCandidate hypothesis:"
)

print(
    "Differences in the representation of upper-ocean "
    "vertical thermal structure may contribute to the "
    "observed temperature bias."
)


print(
    "\nEvidence status:"
)

print(
    "CANDIDATE — evidence-supported, not causally established"
)


print(
    "\nSupporting evidence:"
)

print(
    f"  • Target-layer temperature bias = "
    f"{target_bias:.3f} °C."
)

print(
    f"  • Target layer contains "
    f"{len(target)} matched observations."
)

print(
    f"  • Surface bias = "
    f"{surface_bias:.3f} °C."
)

print(
    f"  • Deep-ocean bias = "
    f"{deep_bias:.3f} °C."
)

print(
    "  • The discrepancy changes substantially "
    "between surface, target, and deep layers."
)


print(
    "\nLimitations / evidence gaps:"
)

print(
    "  • The present dataset demonstrates a "
    "model–observation discrepancy but does not "
    "identify its physical cause."
)

print(
    "  • Mixed-layer depth, stratification, surface "
    "forcing and vertical-mixing diagnostics have "
    "not yet been fully tested."
)


print(
    "\nRecommended investigation:"
)

print(
    "  • Compare mixed-layer depth between datasets."
)

print(
    "  • Compare vertical temperature gradients."
)

print(
    "  • Examine ocean stratification."
)

print(
    "  • Examine surface heat-flux or atmospheric forcing."
)

print(
    "  • Examine vertical-mixing diagnostics if available."
)

print(
    "  • Check whether the pattern persists across "
    "additional months or years."
)


# =========================================================
# HYPOTHESIS 2
# =========================================================

print("\n" + "=" * 60)
print("Possible localized salinity-process discrepancy")
print("=" * 60)


print(
    "\nCandidate hypothesis:"
)

print(
    "The localized salinity mismatch may be associated "
    "with regional processes or model representation "
    "that vary spatially."
)


print(
    "\nEvidence status:"
)

print(
    "CANDIDATE — spatial evidence present, mechanism unresolved"
)


print(
    "\nSupporting evidence:"
)

print(
    f"  • Largest localized salinity bias = "
    f"{salinity_hotspot['salinity_bias']:.3f} PSU."
)

print(
    f"  • Approximate location = "
    f"{salinity_hotspot['latitude_cell']:.1f}°N, "
    f"{salinity_hotspot['longitude_cell']:.1f}°E."
)

print(
    f"  • Hotspot contains "
    f"{int(salinity_hotspot['n'])} matched observations."
)


print(
    "\nLimitations / evidence gaps:"
)

print(
    "  • Spatial localization alone does not establish "
    "the physical mechanism."
)

print(
    "  • River discharge, precipitation, evaporation, "
    "surface fluxes and regional circulation have not "
    "yet been tested."
)


print(
    "\nRecommended investigation:"
)

print(
    "  • Examine nearby Argo profiles individually."
)

print(
    "  • Check whether the hotspot persists across cycles."
)

print(
    "  • Compare model and observation salinity profiles."
)

print(
    "  • Investigate possible freshwater influence."
)

print(
    "  • Examine precipitation and evaporation if available."
)

print(
    "  • Examine regional ocean circulation."
)

print(
    "  • Test the pattern using additional time periods."
)


# =========================================================
# OUTLIER INVESTIGATION
# =========================================================

print("\n" + "=" * 60)
print("OUTLIER INVESTIGATION TARGETS")
print("=" * 60)


print(
    f"\nTemperature: "
    f"{temperature_outlier_count} observations "
    f"with |error| > 2 °C"
)


print(
    f"Salinity: "
    f"{salinity_outlier_count} observations "
    f"with |error| > 1 PSU"
)


print(
    "\nThese remain investigation targets rather than "
    "automatically rejected observations."
)


# =========================================================
# SCIENTIFIC CAUTION
# =========================================================

print("\n" + "=" * 60)
print("SCIENTIFIC CAUTION")
print("=" * 60)


print(
    """
The analysis identifies candidate explanations
supported by currently available evidence.

It does NOT establish a single confirmed physical cause.

Possible explanations include:

  • Upper-ocean vertical structure or mixing
  • Surface or atmospheric forcing
  • Sampling or collocation effects
  • Data-assimilation or reanalysis effects
  • Other regional oceanographic processes

Each explanation requires additional independent
evidence before a causal conclusion can be made.
"""
)


print(
    "\nHypothesis analysis complete."
)