import xarray as xr
import numpy as np


ARGO_FILE = "/Users/nehasreeraj/Desktop/oceanproject_SIH/ARGO/argo_dm_BOB_2024.nc copy"


def load_argo():
    """
    Load Argo Delayed Mode observations.

    Argo remains as individual profile observations.
    It is NOT converted to a regular grid.
    """

    ds = xr.open_dataset(ARGO_FILE)

    return ds


def apply_qc(ds):
    """
    Keep only observations with good Argo QC flags.

    Argo QC flag '1' means good data.
    """

    good_pressure = ds.PRES_QC == "1"
    good_temperature = ds.TEMP_QC == "1"
    good_salinity = ds.PSAL_QC == "1"

    valid = (
        good_pressure
        & good_temperature
        & good_salinity
        & np.isfinite(ds.pressure)
        & np.isfinite(ds.temperature)
        & np.isfinite(ds.salinity)
        & np.isfinite(ds.latitude)
        & np.isfinite(ds.longitude)
    )

    return ds.where(valid, drop=True)


def print_argo_summary(ds):

    print("\n" + "=" * 60)
    print("ARGO DELAYED MODE")
    print("=" * 60)

    print("\nNumber of observations:")
    print(ds.sizes["observation"])

    print("\nVariables:")
    print(list(ds.data_vars))

    print("\nTime:")
    print(ds.time.min().values, "to", ds.time.max().values)

    print("\nLatitude:")
    print(float(ds.latitude.min()), "to", float(ds.latitude.max()))

    print("\nLongitude:")
    print(float(ds.longitude.min()), "to", float(ds.longitude.max()))

    print("\nPressure:")
    print(float(ds.pressure.min()), "to", float(ds.pressure.max()), "dbar")

    print("\nNumber of platforms:")
    print(len(np.unique(ds.platform_number.values)))

    print("\nQC filtering:")
    print("PRES_QC = 1")
    print("TEMP_QC = 1")
    print("PSAL_QC = 1")


if __name__ == "__main__":

    print("Loading Argo...")

    argo = load_argo()

    print("Applying Argo QC filtering...")

    argo = apply_qc(argo)

    print_argo_summary(argo)

    print("\nArgo loading and QC filtering successful.")