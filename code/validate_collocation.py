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
# BASIC INFORMATION
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("COLLOCATION VALIDATION")
print("=" * 60)


# Determine observation dimension.
if "observation" in ds.dims:
    n_obs = ds.sizes["observation"]
elif "time" in ds.dims:
    n_obs = ds.sizes["time"]
else:
    n_obs = len(ds[list(ds.data_vars)[0]])


print("\nNumber of matched observations:")
print(n_obs)


print("\nVariables:")
print(list(ds.data_vars))


# ---------------------------------------------------------
# MISSING VALUE CHECK
# ---------------------------------------------------------

print("\nMissing values:")

variables_to_check = [
    "argo_temperature",
    "model_temperature",
    "temperature_error",
    "argo_salinity",
    "model_salinity",
    "salinity_error",
    "pressure",
    "latitude",
    "longitude",
    "time",
]


for variable in variables_to_check:

    if variable not in ds:
        print(f"{variable}: NOT FOUND")
        continue

    try:
        missing = int(
            ds[variable].isnull().sum().values
        )
    except Exception:
        missing = 0

    print(
        f"{variable}: {missing}"
    )


# ---------------------------------------------------------
# ERROR RANGE CHECK
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("ERROR RANGE CHECK")
print("=" * 60)


temp_error = ds["temperature_error"].values
sal_error = ds["salinity_error"].values


print("\nTemperature error:")

print(
    "Minimum:",
    float(np.nanmin(temp_error))
)

print(
    "Maximum:",
    float(np.nanmax(temp_error))
)


print("\nSalinity error:")

print(
    "Minimum:",
    float(np.nanmin(sal_error))
)

print(
    "Maximum:",
    float(np.nanmax(sal_error))
)


# ---------------------------------------------------------
# DEPTH DISTRIBUTION
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("DEPTH DISTRIBUTION")
print("=" * 60)


pressure = ds["pressure"].values


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


for lower, upper in zip(
    depth_bins[:-1],
    depth_bins[1:]
):

    count = np.sum(
        (pressure >= lower)
        & (pressure < upper)
    )

    print(
        f"{lower:3d}–{upper:3d} dbar: {count}"
    )


# ---------------------------------------------------------
# EXTREME ERROR CHECK
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("EXTREME ERROR CHECK")
print("=" * 60)


temperature_extremes = np.sum(
    np.abs(temp_error) > 2.0
)

salinity_extremes = np.sum(
    np.abs(sal_error) > 1.0
)


print(
    "\nTemperature |error| > 2°C:",
    int(temperature_extremes)
)

print(
    "Salinity |error| > 1 PSU:",
    int(salinity_extremes)
)


# ---------------------------------------------------------
# SCIENTIFIC CAUTION
# ---------------------------------------------------------

print("\n" + "=" * 60)
print("SCIENTIFIC NOTE")
print("=" * 60)

print(
    """
These validation checks identify data-quality and
model–observation discrepancy patterns.

Extreme errors are investigation targets.
They should NOT be automatically classified as
bad observations or removed without further evidence.

Validation does not establish the physical cause
of any model–observation discrepancy.
"""
)


# ---------------------------------------------------------
# COMPLETE
# ---------------------------------------------------------

print("\nValidation checks complete.")