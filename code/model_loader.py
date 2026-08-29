import xarray as xr


HYCOM_FILE = "/Users/nehasreeraj/Desktop/oceanproject_SIH/HYCOM/RSMC_hycom_20260827.nc"

GLORYS_FILE = "/Users/nehasreeraj/Downloads/cmems_mod_glo_phy_my_0.083deg_P1D-m_1787938195229.nc"


def load_hycom():
    """
    Load the INCOIS HYCOM operational dataset
    and standardize variable names.
    """

    ds = xr.open_dataset(HYCOM_FILE)

    ds = ds.rename({
        "TIME": "time",
        "DEPTH": "depth",
        "LAT": "latitude",
        "LON": "longitude",
        "TEMP": "temperature",
        "SALN": "salinity",
        "UVEL": "u_current",
        "VVEL": "v_current",
    })

    return ds


def load_glorys():
    """
    Load the GLORYS12V1 research/reanalysis dataset
    and standardize variable names.
    """

    ds = xr.open_dataset(GLORYS_FILE)

    ds = ds.rename({
        "thetao": "temperature",
        "so": "salinity",
        "uo": "u_current",
        "vo": "v_current",
    })

    return ds


def print_dataset_summary(name, ds):
    """
    Print a simple summary so we can verify the
    standardized dataset.
    """

    print("\n" + "=" * 60)
    print(name)
    print("=" * 60)

    print("\nDimensions:")
    print(ds.dims)

    print("\nCoordinates:")
    print(list(ds.coords))

    print("\nVariables:")
    print(list(ds.data_vars))

    print("\nTime:")
    print(ds.time.values[[0, -1]])

    print("\nLatitude:")
    print(float(ds.latitude.min()), "to", float(ds.latitude.max()))

    print("\nLongitude:")
    print(float(ds.longitude.min()), "to", float(ds.longitude.max()))

    print("\nDepth:")
    print(float(ds.depth.min()), "to", float(ds.depth.max()))


if __name__ == "__main__":

    print("Loading HYCOM...")
    hycom = load_hycom()

    print("Loading GLORYS...")
    glorys = load_glorys()

    print_dataset_summary("HYCOM", hycom)
    print_dataset_summary("GLORYS", glorys)

    print("\nModel loading successful.")
