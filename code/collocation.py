import xarray as xr
import numpy as np
import pandas as pd

from model_loader import load_glorys
from argo_loader import load_argo, apply_qc


# ---------------------------------------------------------
# SETTINGS
# ---------------------------------------------------------

OUTPUT_FILE = (
    "/Users/nehasreeraj/Desktop/oceanproject_SIH/"
    "processed/glorys_argo_collocation_2024.nc"
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

        obs_temp = float(obs.temperature.values)
        obs_salinity = float(obs.salinity.values)

        # -------------------------------------------------
        # CHECK VALUES
        # -------------------------------------------------

        if not np.isfinite(model_temp):
            continue

        if not np.isfinite(model_salinity):
            continue

        if not np.isfinite(obs_temp):
            continue

        if not np.isfinite(obs_salinity):
            continue

        # -------------------------------------------------
        # CALCULATE MODEL - OBSERVATION
        # -------------------------------------------------

        temperature_error = model_temp - obs_temp
        salinity_error = model_salinity - obs_salinity

        # -------------------------------------------------
        # STORE MATCH
        # -------------------------------------------------

        results.append(
            {
                "time": obs_time,
                "latitude": obs_lat,
                "longitude": obs_lon,
                "pressure": obs_pressure,

                "platform_number": str(
                    obs.platform_number.values
                ),

                "cycle_number": str(
                    obs.cycle_number.values
                ),

                "argo_temperature": obs_temp,
                "model_temperature": model_temp,
                "temperature_error": temperature_error,

                "argo_salinity": obs_salinity,
                "model_salinity": model_salinity,
                "salinity_error": salinity_error,
            }
        )

    return pd.DataFrame(results)


# ---------------------------------------------------------
# PRINT SUMMARY
# ---------------------------------------------------------

def print_summary(df):

    print("\n" + "=" * 60)
    print("MODEL–ARGO COLLOCATION SUMMARY")
    print("=" * 60)

    print("\nMatched observations:")
    print(len(df))

    if len(df) == 0:
        print("\nWARNING: No valid matches were produced.")
        return

    print("\nTime:")
    print(df["time"].min(), "to", df["time"].max())

    print("\nLatitude:")
    print(
        df["latitude"].min(),
        "to",
        df["latitude"].max()
    )

    print("\nLongitude:")
    print(
        df["longitude"].min(),
        "to",
        df["longitude"].max()
    )

    print("\nPressure:")
    print(
        df["pressure"].min(),
        "to",
        df["pressure"].max(),
        "dbar"
    )

    # -----------------------------------------------------
    # TEMPERATURE METRICS
    # -----------------------------------------------------

    temperature_bias = df["temperature_error"].mean()

    temperature_rmse = np.sqrt(
        np.mean(
            df["temperature_error"] ** 2
        )
    )

    temperature_mae = np.mean(
        np.abs(df["temperature_error"])
    )

    print("\nTemperature error:")
    print("Mean bias:", temperature_bias)
    print("MAE:", temperature_mae)
    print("RMSE:", temperature_rmse)

    # -----------------------------------------------------
    # SALINITY METRICS
    # -----------------------------------------------------

    salinity_bias = df["salinity_error"].mean()

    salinity_rmse = np.sqrt(
        np.mean(
            df["salinity_error"] ** 2
        )
    )

    salinity_mae = np.mean(
        np.abs(df["salinity_error"])
    )

    print("\nSalinity error:")
    print("Mean bias:", salinity_bias)
    print("MAE:", salinity_mae)
    print("RMSE:", salinity_rmse)


# ---------------------------------------------------------
# SAVE RESULTS
# ---------------------------------------------------------

def save_results(df):

    # Convert IDs to ordinary NumPy Unicode arrays.
    platform_numbers = (
        df["platform_number"]
        .astype(str)
        .to_numpy(dtype="U20")
    )

    cycle_numbers = (
        df["cycle_number"]
        .astype(str)
        .to_numpy(dtype="U20")
    )

    ds = xr.Dataset(
        {
            "argo_temperature": (
                "observation",
                df["argo_temperature"].to_numpy()
            ),

            "model_temperature": (
                "observation",
                df["model_temperature"].to_numpy()
            ),

            "temperature_error": (
                "observation",
                df["temperature_error"].to_numpy()
            ),

            "argo_salinity": (
                "observation",
                df["argo_salinity"].to_numpy()
            ),

            "model_salinity": (
                "observation",
                df["model_salinity"].to_numpy()
            ),

            "salinity_error": (
                "observation",
                df["salinity_error"].to_numpy()
            ),

            "pressure": (
                "observation",
                df["pressure"].to_numpy()
            ),

            "latitude": (
                "observation",
                df["latitude"].to_numpy()
            ),

            "longitude": (
                "observation",
                df["longitude"].to_numpy()
            ),

            "time": (
                "observation",
                df["time"].to_numpy()
            ),

            "platform_number": (
                "observation",
                platform_numbers
            ),

            "cycle_number": (
                "observation",
                cycle_numbers
            ),
        }
    )

    ds.attrs["description"] = (
        "GLORYS12V1 and Argo Delayed Mode "
        "observation-level collocation"
    )

    ds.attrs["pressure_depth_assumption"] = (
        "Argo pressure in dbar treated approximately "
        "as depth in metres for initial collocation."
    )

    ds.attrs["argo_not_gridded"] = (
        "Argo observations remain at their original "
        "observation levels."
    )

    ds.to_netcdf(OUTPUT_FILE)

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

    matched = collocate_observations(
        glorys,
        argo
    )

    print_summary(matched)

    if len(matched) > 0:
        save_results(matched)

    print("\nCollocation complete.")
    