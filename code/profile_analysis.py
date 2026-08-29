import xarray as xr
import numpy as np
import pandas as pd
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

TARGET_MIN_DEPTH = 50
TARGET_MAX_DEPTH = 200

MAX_PROFILES = 100


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
# CONVERT TO DATAFRAME
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
# IDENTIFY INDEPENDENT PROFILES
# ---------------------------------------------------------

if (
    "platform_number" in df.columns
    and "cycle_number" in df.columns
):

    profile_groups = df.groupby(
        [
            "platform_number",
            "cycle_number",
        ],
        dropna=False
    )

elif "platform_number" in df.columns:

    profile_groups = df.groupby(
        ["platform_number"],
        dropna=False
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
        ["profile_id"],
        dropna=False
    )


print(
    "\nIndependent platform/cycle combinations:",
    len(profile_groups)
)


# ---------------------------------------------------------
# STORAGE
# ---------------------------------------------------------

profile_results = []


# ---------------------------------------------------------
# N² CALCULATION
# ---------------------------------------------------------

def calculate_n2(
    salinity,
    temperature,
    pressure,
    latitude,
    longitude
):
    """
    Calculate TEOS-10 buoyancy frequency squared (N²).

    This is a contextual diagnostic.

    It does not establish that stratification caused
    the model–observation temperature discrepancy.
    """

    salinity = np.asarray(
        salinity,
        dtype=float
    )

    temperature = np.asarray(
        temperature,
        dtype=float
    )

    pressure = np.asarray(
        pressure,
        dtype=float
    )

    valid = (
        np.isfinite(salinity)
        & np.isfinite(temperature)
        & np.isfinite(pressure)
    )

    salinity = salinity[valid]
    temperature = temperature[valid]
    pressure = pressure[valid]

    if len(pressure) < 4:
        return None

    # Sort by increasing pressure.
    order = np.argsort(
        pressure
    )

    salinity = salinity[order]
    temperature = temperature[order]
    pressure = pressure[order]

    # Remove duplicate pressure values.
    unique_pressure, unique_indices = (
        np.unique(
            pressure,
            return_index=True
        )
    )

    pressure = unique_pressure
    salinity = salinity[
        unique_indices
    ]
    temperature = temperature[
        unique_indices
    ]

    if len(pressure) < 4:
        return None

    # Convert practical salinity to absolute salinity.
    SA = gsw.SA_from_SP(
        salinity,
        pressure,
        longitude,
        latitude
    )

    # Convert in-situ temperature to Conservative
    # Temperature.
    CT = gsw.CT_from_t(
        SA,
        temperature,
        pressure
    )

    # Calculate N² between adjacent pressure levels.
    N2, p_mid = gsw.Nsquared(
        SA,
        CT,
        pressure,
        latitude=latitude
    )

    valid_n2 = np.isfinite(
        N2
    )

    if valid_n2.sum() == 0:
        return None

    # Use midpoint pressure to select the
    # target 50–200 dbar layer.
    target_mask = (
        (p_mid >= TARGET_MIN_DEPTH)
        & (p_mid <= TARGET_MAX_DEPTH)
        & valid_n2
    )

    if target_mask.sum() == 0:
        return None

    mean_n2 = float(
        np.nanmean(
            N2[target_mask]
        )
    )

    return mean_n2


# ---------------------------------------------------------
# PROFILE LOOP
# ---------------------------------------------------------

for profile_id, profile in profile_groups:

    if len(profile_results) >= MAX_PROFILES:
        break

    profile = profile.sort_values(
        "pressure"
    )

    # Need enough observations for a profile-level
    # temperature bias.
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
    # TARGET-LAYER OBSERVATIONS
    # -----------------------------------------------------

    target_profile = profile[
        (profile["pressure"] >= TARGET_MIN_DEPTH)
        & (profile["pressure"] <= TARGET_MAX_DEPTH)
    ]

    if len(target_profile) < 2:
        continue

    temp_bias = float(
        target_profile[
            "temperature_error"
        ].mean()
    )

    if not np.isfinite(
        temp_bias
    ):
        continue

    # -----------------------------------------------------
    # GET MODEL PROFILE
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
    # MODEL VARIABLES
    # -----------------------------------------------------

    if (
        "thetao" not in model_profile
        or "so" not in model_profile
    ):
        continue

    model_depth = np.asarray(
        glorys["depth"].values,
        dtype=float
    )

    model_temperature = np.asarray(
        model_profile["thetao"].values,
        dtype=float
    )

    model_salinity = np.asarray(
        model_profile["so"].values,
        dtype=float
    )

    # -----------------------------------------------------
    # VALID MODEL DATA
    # -----------------------------------------------------

    valid = (
        np.isfinite(model_depth)
        & np.isfinite(model_temperature)
        & np.isfinite(model_salinity)
    )

    model_depth = model_depth[
        valid
    ]

    model_temperature = (
        model_temperature[valid]
    )

    model_salinity = (
        model_salinity[valid]
    )

    # -----------------------------------------------------
    # TARGET MODEL LAYER
    # -----------------------------------------------------

    target_mask = (
        (model_depth >= TARGET_MIN_DEPTH)
        & (model_depth <= TARGET_MAX_DEPTH)
    )

    if target_mask.sum() < 4:
        continue

    target_depth = (
        model_depth[target_mask]
    )

    target_temperature = (
        model_temperature[target_mask]
    )

    target_salinity = (
        model_salinity[target_mask]
    )

    # -----------------------------------------------------
    # CALCULATE N²
    # -----------------------------------------------------

    mean_n2 = calculate_n2(
        target_salinity,
        target_temperature,
        gsw.p_from_z(
            -target_depth,
            latitude
        ),
        latitude,
        longitude
    )

    if mean_n2 is None:
        continue

    # -----------------------------------------------------
    # STORE PROFILE RESULT
    # -----------------------------------------------------

    profile_results.append({
        "profile": str(profile_id),
        "n": len(target_profile),
        "temperature_bias": temp_bias,
        "mean_n2": mean_n2,
    })


# ---------------------------------------------------------
# RESULTS DATAFRAME
# ---------------------------------------------------------

results = pd.DataFrame(
    profile_results
)


print("\n" + "=" * 60)
print("PROFILE-LEVEL N² ANALYSIS")
print("=" * 60)


print(
    "\nPurpose:"
)

print(
    "Assess whether the model temperature discrepancy "
    "is consistently associated with modeled "
    "stratification across independent Argo profiles."
)


print(
    "\nScientific caution:"
)

print(
    "An association does not establish that "
    "stratification caused the model error."
)


print(
    "\nProfiles successfully analyzed:",
    len(results)
)


# ---------------------------------------------------------
# PROFILE RESULTS
# ---------------------------------------------------------

if len(results) > 0:

    print("\n" + "=" * 60)
    print("PROFILE-LEVEL RESULTS")
    print("=" * 60)

    print(
        "\nPlatform/Cycle"
        "                     N"
        "      Temp Bias"
        "        Mean N²"
    )

    for _, row in results.iterrows():

        print(
            f"{str(row['profile']):<32}"
            f"{int(row['n']):>6}"
            f"{row['temperature_bias']:>16.3f}"
            f"{row['mean_n2']:>18.4e}"
        )


# ---------------------------------------------------------
# CORRELATION
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("PROFILE ASSOCIATION")
print("=" * 60)


if len(results) >= 3:

    bias_values = (
        results[
            "temperature_bias"
        ].to_numpy()
    )

    n2_values = (
        results[
            "mean_n2"
        ].to_numpy()
    )

    valid = (
        np.isfinite(
            bias_values
        )
        & np.isfinite(
            n2_values
        )
    )

    bias_values = (
        bias_values[valid]
    )

    n2_values = (
        n2_values[valid]
    )

    if (
        len(bias_values) >= 3
        and np.std(bias_values) > 0
        and np.std(n2_values) > 0
    ):

        correlation = float(
            np.corrcoef(
                bias_values,
                n2_values
            )[0, 1]
        )

    else:

        correlation = np.nan

else:

    correlation = np.nan


print(
    "\nTemperature-bias vs 50–200 dbar N² correlation:"
)


if np.isfinite(
    correlation
):

    print(
        f"{correlation:.3f}"
    )

else:

    print(
        "Not available — insufficient variation "
        "or valid profiles."
    )


# ---------------------------------------------------------
# PROFILE CONSISTENCY
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("PROFILE CONSISTENCY")
print("=" * 60)


if len(results) > 0:

    high_bias = results[
        results["temperature_bias"] > 0.3
    ]

    lower_bias = results[
        results["temperature_bias"] <= 0.3
    ]

    print(
        "\nProfiles with temperature bias > +0.3°C:",
        len(high_bias)
    )

    print(
        "Profiles with bias <= +0.3°C:",
        len(lower_bias)
    )

    if len(high_bias) > 0:

        print(
            "\nMean N² for profiles with bias > +0.3°C:"
        )

        print(
            float(
                high_bias["mean_n2"].mean()
            )
        )

    else:

        print(
            "\nMean N² for profiles with bias > +0.3°C:"
        )

        print(
            "Not available."
        )

    if len(lower_bias) > 0:

        print(
            "\nMean N² for profiles with bias <= +0.3°C:"
        )

        print(
            float(
                lower_bias["mean_n2"].mean()
            )
        )

    else:

        print(
            "\nMean N² for profiles with bias <= +0.3°C:"
        )

        print(
            "Not available."
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

The 50–200 dbar temperature discrepancy is robust
in the collocated dataset.

New test:

We have examined the relationship at the independent
Argo-profile level using TEOS-10 N².

Important limitation:

A relationship between temperature bias and N² would
be evidence of association, not proof of a mixing or
stratification cause.

A weak or near-zero relationship would also NOT prove
that stratification or mixing is irrelevant. It would
only indicate that this particular diagnostic does not
explain much of the observed profile-to-profile variation.
"""
)


# ---------------------------------------------------------
# POSSIBLE EXPLANATIONS
# ---------------------------------------------------------

print(
    "\nPossible explanations remain:"
)

print(
    "  • Vertical mixing or vertical-structure differences"
)

print(
    "  • Surface or atmospheric forcing"
)

print(
    "  • Sampling or collocation effects"
)

print(
    "  • Data-assimilation or reanalysis effects"
)

print(
    "  • Other regional oceanographic processes"
)


# ---------------------------------------------------------
# POSSIBLE NEXT INVESTIGATIONS
# ---------------------------------------------------------

print(
    "\nPossible next investigations:"
)

print(
    "  → Compare complete Argo and GLORYS profiles."
)

print(
    "  → Compare mixed-layer depth."
)

print(
    "  → Examine vertical diffusivity/mixing diagnostics."
)

print(
    "  → Compare surface forcing."
)

print(
    "  → Repeat across additional months or years."
)

print(
    "  → Test additional independent Argo platforms."
)


print(
    "\nProfile-level analysis complete."
)