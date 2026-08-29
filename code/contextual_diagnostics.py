import xarray as xr
import numpy as np
from pathlib import Path

import gsw


# ---------------------------------------------------------
# PROJECT PATHS
# ---------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent

COLLOCATION_FILE = (
    PROJECT_ROOT
    / "processed"
    / "glorys_argo_collocation_2024.nc"
)

GLORYS_FILE = (
    PROJECT_ROOT
    / "GLORY"
    / "cmems_mod_glo_phy_my_0.083deg_P1D-m_1787938195229.nc"
)


# ---------------------------------------------------------
# SETTINGS
# ---------------------------------------------------------

MAX_PROFILES = 100

TARGET_MIN_DEPTH = 50
TARGET_MAX_DEPTH = 200


# ---------------------------------------------------------
# LOAD DATA
# ---------------------------------------------------------

print("Loading collocated observations...")
collocated = xr.open_dataset(
    COLLOCATION_FILE
)

print("Loading GLORYS...")
glorys = xr.open_dataset(
    GLORYS_FILE
)


# ---------------------------------------------------------
# CONVERT COLLOCATION TO DATAFRAME
# ---------------------------------------------------------

df = collocated.to_dataframe().reset_index()

df = df.dropna(
    subset=[
        "temperature_error",
        "pressure",
        "latitude",
        "longitude",
        "time",
    ]
)


# ---------------------------------------------------------
# IDENTIFY PROFILES
# ---------------------------------------------------------

if "platform_number" in df.columns:

    if "cycle_number" in df.columns:

        profile_groups = df.groupby(
            [
                "platform_number",
                "cycle_number",
            ]
        )

    else:

        profile_groups = df.groupby(
            ["platform_number"]
        )

else:

    # Fallback if profile identifiers are unavailable.
    df["profile_id"] = (
        df["latitude"].round(2).astype(str)
        + "_"
        + df["longitude"].round(2).astype(str)
        + "_"
        + df["time"].astype(str)
    )

    profile_groups = df.groupby(
        "profile_id"
    )


# ---------------------------------------------------------
# DIAGNOSTIC STORAGE
# ---------------------------------------------------------

temperature_errors = []
temperature_gradients = []
density_gradients = []

processed_profiles = 0


# ---------------------------------------------------------
# PROFILE ANALYSIS
# ---------------------------------------------------------

for profile_id, profile in profile_groups:

    if processed_profiles >= MAX_PROFILES:
        break

    profile = profile.sort_values(
        "pressure"
    )

    if len(profile) < 3:
        continue

    latitude = float(
        profile["latitude"].iloc[0]
    )

    longitude = float(
        profile["longitude"].iloc[0]
    )

    time = profile["time"].iloc[0]

    # -----------------------------------------------------
    # CHECK TARGET-LAYER COVERAGE
    # -----------------------------------------------------

    target_profile = profile[
        (profile["pressure"] >= TARGET_MIN_DEPTH)
        & (profile["pressure"] <= TARGET_MAX_DEPTH)
    ]

    if len(target_profile) < 3:
        continue

    # -----------------------------------------------------
    # MODEL PROFILE EXTRACTION
    # -----------------------------------------------------

    try:

        model_profile = glorys.interp(
            time=np.datetime64(time),
            latitude=latitude,
            longitude=longitude,
            method="linear"
        )

    except Exception:
        continue

    # -----------------------------------------------------
    # MODEL TEMPERATURE
    # -----------------------------------------------------

    if "thetao" not in model_profile:
        continue

    model_temperature = (
        model_profile["thetao"]
        .values
    )

    model_depth = (
        glorys["depth"]
        .values
    )

    model_temperature = np.asarray(
        model_temperature,
        dtype=float
    )

    model_depth = np.asarray(
        model_depth,
        dtype=float
    )

    valid_model = (
        np.isfinite(model_depth)
        & np.isfinite(model_temperature)
    )

    model_depth = model_depth[
        valid_model
    ]

    model_temperature = model_temperature[
        valid_model
    ]

    if len(model_depth) < 3:
        continue

    # -----------------------------------------------------
    # TARGET-LAYER MODEL PROFILE
    # -----------------------------------------------------

    target_model_mask = (
        (model_depth >= TARGET_MIN_DEPTH)
        & (model_depth <= TARGET_MAX_DEPTH)
    )

    target_model_depth = (
        model_depth[target_model_mask]
    )

    target_model_temperature = (
        model_temperature[target_model_mask]
    )

    if len(target_model_depth) < 3:
        continue

    # -----------------------------------------------------
    # MODEL TEMPERATURE GRADIENT
    # -----------------------------------------------------

    temperature_gradient = np.gradient(
        target_model_temperature,
        target_model_depth
    )

    mean_temperature_gradient = float(
        np.nanmean(
            np.abs(
                temperature_gradient
            )
        )
    )

    # -----------------------------------------------------
    # TEOS-10 DENSITY
    # -----------------------------------------------------

    # GLORYS salinity is practical salinity.
    # For contextual diagnostics we use it as SP.

    if "so" not in model_profile:
        continue

    model_salinity = (
        model_profile["so"]
        .values
    )

    model_salinity = np.asarray(
        model_salinity,
        dtype=float
    )

    model_salinity = model_salinity[
        valid_model
    ]

    if len(model_salinity) != len(
        model_depth
    ):
        continue

    target_model_salinity = (
        model_salinity[target_model_mask]
    )

    if len(target_model_salinity) != len(
        target_model_depth
    ):
        continue

    valid_density = (
        np.isfinite(
            target_model_salinity
        )
        & np.isfinite(
            target_model_temperature
        )
        & np.isfinite(
            target_model_depth
        )
    )

    if valid_density.sum() < 3:
        continue

    salinity = (
        target_model_salinity[
            valid_density
        ]
    )

    temperature = (
        target_model_temperature[
            valid_density
        ]
    )

    depth = (
        target_model_depth[
            valid_density
        ]
    )

    # Approximate pressure from depth.
    pressure = gsw.p_from_z(
        -depth,
        latitude
    )

    # Convert SP -> Absolute Salinity.
    absolute_salinity = (
        gsw.SA_from_SP(
            salinity,
            pressure,
            longitude,
            latitude
        )
    )

    # Conservative Temperature.
    conservative_temperature = (
        gsw.CT_from_t(
            absolute_salinity,
            temperature,
            pressure
        )
    )

    # In-situ density.
    density = gsw.rho(
        absolute_salinity,
        conservative_temperature,
        pressure
    )

    # -----------------------------------------------------
    # DENSITY GRADIENT
    # -----------------------------------------------------

    density_gradient = np.gradient(
        density,
        depth
    )

    mean_density_gradient = float(
        np.nanmean(
            np.abs(
                density_gradient
            )
        )
    )

    # -----------------------------------------------------
    # PROFILE TEMPERATURE ERROR
    # -----------------------------------------------------

    profile_error = float(
        target_profile[
            "temperature_error"
        ].mean()
    )

    if not np.isfinite(
        profile_error
    ):
        continue

    if not np.isfinite(
        mean_temperature_gradient
    ):
        continue

    if not np.isfinite(
        mean_density_gradient
    ):
        continue

    temperature_errors.append(
        profile_error
    )

    temperature_gradients.append(
        mean_temperature_gradient
    )

    density_gradients.append(
        mean_density_gradient
    )

    processed_profiles += 1


# ---------------------------------------------------------
# RESULTS
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("TEOS-10 CONTEXTUAL DIAGNOSTICS")
print("=" * 60)


print(
    "\nPurpose:"
)

print(
    "Test whether the observed temperature discrepancy "
    "is associated with modeled vertical thermal or "
    "density structure."
)


print(
    "\nScientific caution:"
)

print(
    "A statistical association does not establish that "
    "stratification or mixing caused the model error."
)


print(
    f"\nProfiles successfully processed: "
    f"{processed_profiles}"
)


# ---------------------------------------------------------
# CORRELATION FUNCTION
# ---------------------------------------------------------

def safe_correlation(
    x,
    y
):

    x = np.asarray(
        x,
        dtype=float
    )

    y = np.asarray(
        y,
        dtype=float
    )

    valid = (
        np.isfinite(x)
        & np.isfinite(y)
    )

    x = x[valid]
    y = y[valid]

    if len(x) < 3:
        return np.nan

    if np.std(x) == 0:
        return np.nan

    if np.std(y) == 0:
        return np.nan

    return float(
        np.corrcoef(
            x,
            y
        )[0, 1]
    )


# ---------------------------------------------------------
# THERMAL ASSOCIATION
# ---------------------------------------------------------

temperature_error_array = np.asarray(
    temperature_errors
)

temperature_gradient_array = np.asarray(
    temperature_gradients
)

density_gradient_array = np.asarray(
    density_gradients
)


thermal_correlation = safe_correlation(
    temperature_error_array,
    temperature_gradient_array
)


density_correlation = safe_correlation(
    temperature_error_array,
    density_gradient_array
)


print("\n" + "=" * 60)
print("THERMAL STRUCTURE ASSOCIATION")
print("=" * 60)


print(
    "\nTemperature-error vs 50–200 dbar "
    "temperature-gradient correlation:"
)

if np.isfinite(
    thermal_correlation
):

    print(
        f"{thermal_correlation:.3f}"
    )

else:

    print(
        "Not available — insufficient variation "
        "or valid profiles."
    )


print("\n" + "=" * 60)
print("DENSITY STRATIFICATION ASSOCIATION")
print("=" * 60)


print(
    "\nTemperature-error vs 50–200 dbar "
    "density-gradient correlation:"
)

if np.isfinite(
    density_correlation
):

    print(
        f"{density_correlation:.3f}"
    )

else:

    print(
        "Not available — insufficient variation "
        "or valid profiles."
    )


# ---------------------------------------------------------
# SCIENTIFIC INTERPRETATION
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("SCIENTIFIC INTERPRETATION")
print("=" * 60)


print(
    """
Observed:

A positive temperature discrepancy has already been
detected in the 50–200 dbar layer.

What this analysis can test:

Whether that discrepancy is statistically associated
with modeled vertical thermal or density structure.

What it cannot establish:

A correlation cannot prove that vertical mixing,
stratification, or another physical process caused
the model error.
"""
)


# ---------------------------------------------------------
# INTERPRETATION OF CORRELATIONS
# ---------------------------------------------------------

print(
    "\nInterpretation of current associations:"
)


if np.isfinite(
    thermal_correlation
):

    print(
        f"  • Thermal-structure correlation = "
        f"{thermal_correlation:.3f}"
    )

else:

    print(
        "  • Thermal-structure correlation could "
        "not be reliably estimated."
    )


if np.isfinite(
    density_correlation
):

    print(
        f"  • Density-gradient correlation = "
        f"{density_correlation:.3f}"
    )

else:

    print(
        "  • Density-gradient correlation could "
        "not be reliably estimated."
    )


print(
    """
Even if an association is present, several explanations
remain possible.

For example:

  • Differences in vertical mixing
  • Differences in model stratification
  • Surface forcing errors
  • Sampling or collocation effects
  • Data-assimilation effects
  • Other regional processes

Therefore, these results should be reported as
evidence of association, not as proof of causation.
"""
)


# ---------------------------------------------------------
# POSSIBLE NEXT INVESTIGATIONS
# ---------------------------------------------------------

print(
    "\nPossible next investigations:"
)

print(
    "  → Compare full Argo and GLORYS profiles."
)

print(
    "  → Calculate mixed-layer depth."
)

print(
    "  → Examine buoyancy frequency (N²)."
)

print(
    "  → Examine vertical mixing diagnostics."
)

print(
    "  → Compare surface forcing."
)

print(
    "  → Test additional dates and Argo platforms."
)

print(
    "  → Repeat the analysis over additional months "
    "or years."
)


print(
    "\nTEOS-10 contextual diagnostics complete."
)