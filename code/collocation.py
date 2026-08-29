import xarray as xr
import numpy as np
import pandas as pd
from pathlib import Path

from model_loader import load_glorys
from argo_loader import load_argo, apply_qc


# ---------------------------------------------------------
# PROJECT PATHS
# ---------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent

OUTPUT_FILE = (
    PROJECT_ROOT / "processed" / "glorys_argo_collocation_2024.nc"
)


# ---------------------------------------------------------
# PREPARE GLORYS
# ---------------------------------------------------------

def prepare_glorys():

    ds = load_glorys()

    # Make sure coordinates are sorted.
    ds = ds.sortby(
        ["time", "depth", "latitude", "longitude"]
    )

    return ds


# ---------------------------------------------------------
# PREPARE ARGO
# ---------------------------------------------------------

def prepare_argo():

    argo = load_argo()

    # Apply Argo QC.
    argo = apply_qc(argo)

    # Keep only the GLORYS comparison period.
    start = np.datetime64("2024-01-01")
    end = np.datetime64("2024-01-15T23:59:59")

    argo = argo.where(
        (argo.time >= start) & (argo.time <= end),
        drop=True
    )

    return argo


# ---------------------------------------------------------
# COLLOCATE OBSERVATIONS
# ---------------------------------------------------------

def collocate_observations(glorys, argo):

    results = []

    print("\nStarting model-observation collocation...")
    print("Argo observations:", argo.sizes["observation"])

    for i in range(argo.sizes["observation"]):

        obs = argo.isel(observation=i)

        obs_time = obs.time.values
        obs_lat = float(obs.latitude.values)
        obs_lon = float(obs.longitude.values)
        obs_pressure = float(obs.pressure.values)

        # -------------------------------------------------
        # VALIDITY CHECK
        # -------------------------------------------------

        if np.isnat(obs_time):
            continue

        if not np.isfinite(obs_pressure):
            continue

        if obs_pressure < 0 or obs_pressure > 500:
            continue

        # -------------------------------------------------
        # INTERPOLATE GLORYS
        # -------------------------------------------------

        try:

            model_point = glorys.interp(
                time=obs_time,
                latitude=obs_lat,
                longitude=obs_lon,
                depth=obs_pressure,
                method="linear"
            )

        except Exception:
            continue

        model_temp = float(
            model_point.temperature.values
        )

        model_salinity = float(
            model_point.salinity.values
        )

        # -------------------------------------------------
        # ARGO OBSERVATIONS
        # -------------------------------------------------

        obs_temp = float(
            obs.temperature.values
        )

        obs_salinity = float(
            obs.salinity.values
        )

        # -------------------------------------------------
        # ERROR
        # -------------------------------------------------

        temperature_error = (
            model_temp - obs_temp
        )

        salinity_error = (
            model_salinity - obs_salinity
        )

        # -------------------------------------------------
        # STORE RESULT
        # -------------------------------------------------

        results.append({
            "argo_temperature": obs_temp,
            "model_temperature": model_temp,
            "temperature_error": temperature_error,
            "argo_salinity": obs_salinity,
            "model_salinity": model_salinity,
            "salinity_error": salinity_error,
            "pressure": obs_pressure,
            "latitude": obs_lat,
            "longitude": obs_lon,
            "time": obs_time,
            "platform_number": str(
                obs.platform_number.values
            ),
            "cycle_number": int(
                obs.cycle_number.values
            )
        })

    return results


# ---------------------------------------------------------
# CREATE DATASET
# ---------------------------------------------------------

def create_dataset(results):

    df = pd.DataFrame(results)

    if df.empty:
        raise RuntimeError(
            "No observations were successfully collocated."
        )

    # Explicitly convert columns to standard NumPy types.
    # This avoids pandas StringDtype problems when writing
    # the dataset to NetCDF.

    df["argo_temperature"] = (
        pd.to_numeric(
            df["argo_temperature"],
            errors="coerce"
        ).astype("float32")
    )

    df["model_temperature"] = (
        pd.to_numeric(
            df["model_temperature"],
            errors="coerce"
        ).astype("float32")
    )

    df["temperature_error"] = (
        pd.to_numeric(
            df["temperature_error"],
            errors="coerce"
        ).astype("float32")
    )

    df["argo_salinity"] = (
        pd.to_numeric(
            df["argo_salinity"],
            errors="coerce"
        ).astype("float32")
    )

    df["model_salinity"] = (
        pd.to_numeric(
            df["model_salinity"],
            errors="coerce"
        ).astype("float32")
    )

    df["salinity_error"] = (
        pd.to_numeric(
            df["salinity_error"],
            errors="coerce"
        ).astype("float32")
    )

    df["pressure"] = (
        pd.to_numeric(
            df["pressure"],
            errors="coerce"
        ).astype("float32")
    )

    df["latitude"] = (
        pd.to_numeric(
            df["latitude"],
            errors="coerce"
        ).astype("float64")
    )

    df["longitude"] = (
        pd.to_numeric(
            df["longitude"],
            errors="coerce"
        ).astype("float64")
    )

    df["time"] = pd.to_datetime(
        df["time"]
    )

    df["platform_number"] = (
        df["platform_number"]
        .astype(str)
    )

    df["cycle_number"] = (
        pd.to_numeric(
            df["cycle_number"],
            errors="coerce"
        ).fillna(-1)
        .astype("int64")
    )

    ds = xr.Dataset.from_dataframe(
        df.set_index("time")
    )

    # Restore a simple observation dimension.
    ds = ds.reset_index("time")

    # Make sure time is explicitly datetime64.
    ds["time"] = ds["time"].astype(
        "datetime64[ns]"
    )

    return ds


# ---------------------------------------------------------
# SUMMARY
# ---------------------------------------------------------

def print_summary(ds):

    print("\n" + "=" * 60)
    print("MODEL–ARGO COLLOCATION SUMMARY")
    print("=" * 60)

    n = ds.sizes["time"]

    print("\nMatched observations:")
    print(n)

    print("\nTime:")
    print(
        ds.time.min().values,
        "to",
        ds.time.max().values
    )

    print("\nLatitude:")
    print(
        float(ds.latitude.min()),
        "to",
        float(ds.latitude.max())
    )

    print("\nLongitude:")
    print(
        float(ds.longitude.min()),
        "to",
        float(ds.longitude.max())
    )

    print("\nPressure:")
    print(
        float(ds.pressure.min()),
        "to",
        float(ds.pressure.max()),
        "dbar"
    )

    print("\nTemperature error:")

    temp_error = ds.temperature_error.values

    print(
        "Mean bias:",
        float(np.nanmean(temp_error))
    )

    print(
        "MAE:",
        float(np.nanmean(np.abs(temp_error)))
    )

    print(
        "RMSE:",
        float(
            np.sqrt(
                np.nanmean(
                    temp_error ** 2
                )
            )
        )
    )

    print("\nSalinity error:")

    sal_error = ds.salinity_error.values

    print(
        "Mean bias:",
        float(np.nanmean(sal_error))
    )

    print(
        "MAE:",
        float(np.nanmean(np.abs(sal_error)))
    )

    print(
        "RMSE:",
        float(
            np.sqrt(
                np.nanmean(
                    sal_error ** 2
                )
            )
        )
    )


# ---------------------------------------------------------
# SAVE RESULTS
# ---------------------------------------------------------

def save_results(ds):

    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    ds.to_netcdf(
        OUTPUT_FILE,
        engine="netcdf4"
    )

    print("\nSaved:")
    print(OUTPUT_FILE)


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

if __name__ == "__main__":

    print("Loading GLORYS...")
    glorys = prepare_glorys()

    print("Loading Argo...")
    argo = prepare_argo()

    results = collocate_observations(
        glorys,
        argo
    )

    matched = create_dataset(
        results
    )

    print_summary(
        matched
    )

    save_results(
        matched
    )

    print(
        "\nCollocation complete."
    )