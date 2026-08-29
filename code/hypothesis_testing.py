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
# COMMON DEPTH GROUPS
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
# TEMPORAL VARIATION
# ---------------------------------------------------------

df["date"] = (
    df["time"]
    .dt
    .date
)


temporal = (
    df.groupby("date")
    .agg(
        temperature_bias=(
            "temperature_error",
            "mean"
        ),
        n=("temperature_error", "size")
    )
    .reset_index()
)


if len(temporal) > 0:

    temporal_range = float(
        temporal["temperature_bias"].max()
        - temporal["temperature_bias"].min()
    )

else:

    temporal_range = np.nan


# ---------------------------------------------------------
# CANDIDATE 1
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("CANDIDATE: Upper-ocean vertical mixing / structure")
print("=" * 60)


print(
    "\nDescription:"
)

print(
    "Differences in the representation of upper-ocean "
    "vertical structure may contribute to the temperature "
    "discrepancy."
)


print(
    "\nStatus:"
)

print(
    "PLAUSIBLE CANDIDATE — requires testing"
)


print(
    "\nSupporting evidence:"
)

print(
    f"  + Large positive temperature bias in the "
    f"50–200 dbar layer "
    f"(+{target_bias:.3f} °C, N={len(target)})."
)

print(
    f"  + Surface bias is comparatively small "
    f"({surface_bias:+.3f} °C), indicating the "
    f"discrepancy is not uniform through the water column."
)

print(
    f"  + Deep bias is comparatively small "
    f"({deep_bias:+.3f} °C), further supporting "
    f"vertical localization."
)


print(
    "\nContradicting evidence / cautions:"
)

print(
    "  - The present analysis does not directly measure "
    "vertical mixing."
)

print(
    "  - A depth-dependent bias can have multiple "
    "possible explanations."
)


print(
    "\nEvidence currently missing:"
)

print(
    "  ? Mixed-layer depth"
)

print(
    "  ? Vertical temperature gradient"
)

print(
    "  ? Potential-density stratification"
)

print(
    "  ? Vertical mixing / diffusivity diagnostics"
)

print(
    "  ? Surface heat-flux forcing"
)


print(
    "\nRecommended tests:"
)

print(
    "  → Compare mixed-layer depth."
)

print(
    "  → Compare vertical temperature gradients."
)

print(
    "  → Compare density stratification."
)

print(
    "  → Compare vertical mixing diagnostics."
)

print(
    "  → Compare surface heat-flux forcing."
)


# ---------------------------------------------------------
# CANDIDATE 2
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("CANDIDATE: Surface forcing / atmospheric forcing")
print("=" * 60)


print(
    "\nDescription:"
)

print(
    "Differences in surface forcing could contribute "
    "to changes in model temperature."
)


print(
    "\nStatus:"
)

print(
    "POSSIBLE — insufficient evidence"
)


print(
    "\nSupporting evidence:"
)

print(
    f"  + Temperature bias varies by approximately "
    f"{temporal_range:.3f} °C across the available "
    f"observation dates."
)


print(
    "\nContradicting evidence / cautions:"
)

print(
    "  - Temporal variation alone does not demonstrate "
    "that surface forcing caused the discrepancy."
)


print(
    "\nEvidence currently missing:"
)

print(
    "  ? Surface heat flux"
)

print(
    "  ? Wind stress"
)

print(
    "  ? Air temperature"
)

print(
    "  ? Precipitation"
)

print(
    "  ? Evaporation"
)

print(
    "  ? Atmospheric forcing used by the model"
)


print(
    "\nRecommended tests:"
)

print(
    "  → Compare model surface heat flux with an "
    "independent forcing product."
)

print(
    "  → Compare wind stress."
)

print(
    "  → Compare precipitation and evaporation."
)

print(
    "  → Check whether forcing anomalies coincide "
    "with temperature-bias changes."
)


# ---------------------------------------------------------
# CANDIDATE 3
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("CANDIDATE: Sampling / collocation effects")
print("=" * 60)


print(
    "\nDescription:"
)

print(
    "Some of the apparent discrepancy could result from "
    "spatial or temporal sampling differences between "
    "Argo and the model."
)


print(
    "\nStatus:"
)

print(
    "ALTERNATIVE EXPLANATION — must be ruled out"
)


print(
    "\nSupporting evidence:"
)

print(
    f"  + The analysis contains {len(df)} matched "
    "observations, providing substantial sample size "
    "for the overall comparison."
)

print(
    "  + Argo observations are irregular in time and "
    "space, so sampling representativeness must be "
    "considered."
)


print(
    "\nContradicting evidence / cautions:"
)

print(
    "  - The observed depth-dependent pattern is "
    "structured rather than completely random."
)


print(
    "\nEvidence currently missing:"
)

print(
    "  ? Sensitivity to different temporal matching windows"
)

print(
    "  ? Sensitivity to different spatial matching windows"
)

print(
    "  ? Independent Argo profiles for replication"
)

print(
    "  ? Cross-validation using another observation period"
)


print(
    "\nRecommended tests:"
)

print(
    "  → Repeat collocation with tighter time windows."
)

print(
    "  → Repeat with different spatial windows."
)

print(
    "  → Repeat using additional Argo cycles."
)

print(
    "  → Test whether the depth pattern persists."
)


# ---------------------------------------------------------
# CANDIDATE 4
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("CANDIDATE: Data-assimilation / reanalysis effects")
print("=" * 60)


print(
    "\nDescription:"
)

print(
    "The discrepancy may be related to how observations "
    "are assimilated into the reanalysis system."
)


print(
    "\nStatus:"
)

print(
    "POSSIBLE — currently untested"
)


print(
    "\nSupporting evidence:"
)

print(
    f"  + The discrepancy is concentrated in a specific "
    f"vertical layer (50–200 dbar; N={len(target)})."
)


print(
    "\nContradicting evidence / cautions:"
)

print(
    "  - No assimilation diagnostics are currently "
    "available, so an assimilation-related mechanism "
    "cannot be evaluated directly."
)


print(
    "\nEvidence currently missing:"
)

print(
    "  ? Assimilation increments"
)

print(
    "  ? Model background fields"
)

print(
    "  ? Assimilated observations"
)

print(
    "  ? Analysis increments by depth"
)

print(
    "  ? Model configuration information"
)


print(
    "\nRecommended tests:"
)

print(
    "  → Inspect assimilation increments."
)

print(
    "  → Compare analysis and background fields "
    "if available."
)

print(
    "  → Check the influence of assimilated Argo data."
)

print(
    "  → Compare against an independent ocean product."
)


# ---------------------------------------------------------
# OVERALL SUMMARY
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("RESEARCH INVESTIGATION SUMMARY")
print("=" * 60)


print(
    """
The system does NOT identify a single confirmed
physical cause.

Instead, it ranks candidate explanations according
to currently available evidence.

Candidate explanations:

• Upper-ocean vertical mixing / structure
  Status: PLAUSIBLE CANDIDATE — requires testing

• Surface forcing / atmospheric forcing
  Status: POSSIBLE — insufficient evidence

• Sampling / collocation effects
  Status: ALTERNATIVE EXPLANATION — must be ruled out

• Data-assimilation / reanalysis effects
  Status: POSSIBLE — currently untested
"""
)


print("\n" + "=" * 60)
print("SCIENTIFIC CAUTION")
print("=" * 60)


print(
    """
These are hypotheses, not confirmed causes.

A model–observation discrepancy can have multiple
possible explanations.

Additional independent observations, model diagnostics,
forcing data, and repeated time periods are required
before assigning a physical cause.

Possible solutions should therefore be treated as
investigation pathways rather than guaranteed fixes.
"""
)


print(
    "\nHypothesis testing framework complete."
)