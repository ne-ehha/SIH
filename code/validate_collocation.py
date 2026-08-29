import xarray as xr
import numpy as np


FILE = (
    "/Users/nehasreeraj/Desktop/oceanproject_SIH/"
    "processed/glorys_argo_collocation_2024.nc"
)


def load_collocation():
    return xr.open_dataset(FILE)


def print_basic_checks(ds):

    print("\n" + "=" * 60)
    print("COLLOCATION VALIDATION")
    print("=" * 60)

    print("\nNumber of matched observations:")
    print(ds.sizes["observation"])

    print("\nVariables:")
    print(list(ds.data_vars))

    print("\nMissing values:")

    for variable in [
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
    ]:
        missing = int(ds[variable].isnull().sum())
        print(f"{variable}: {missing}")


def print_error_ranges(ds):

    print("\n" + "=" * 60)
    print("ERROR RANGE CHECK")
    print("=" * 60)

    temp_error = ds.temperature_error.values
    sal_error = ds.salinity_error.values

    print("\nTemperature error:")
    print("Minimum:", np.nanmin(temp_error))
    print("Maximum:", np.nanmax(temp_error))

    print("\nSalinity error:")
    print("Minimum:", np.nanmin(sal_error))
    print("Maximum:", np.nanmax(sal_error))


def print_depth_distribution(ds):

    print("\n" + "=" * 60)
    print("DEPTH DISTRIBUTION")
    print("=" * 60)

    pressure = ds.pressure.values

    bins = [0, 10, 25, 50, 100, 200, 300, 400, 500]

    counts, _ = np.histogram(
        pressure,
        bins=bins
    )

    for i in range(len(bins) - 1):

        print(
            f"{bins[i]:>3}–{bins[i+1]:>3} dbar:",
            counts[i]
        )


def print_extreme_errors(ds):

    print("\n" + "=" * 60)
    print("EXTREME ERROR CHECK")
    print("=" * 60)

    temp_error = ds.temperature_error.values
    sal_error = ds.salinity_error.values

    print(
        "\nTemperature |error| > 2°C:",
        np.sum(np.abs(temp_error) > 2)
    )

    print(
        "Salinity |error| > 1 PSU:",
        np.sum(np.abs(sal_error) > 1)
    )


def main():

    print("Loading collocated dataset...")

    ds = load_collocation()

    print_basic_checks(ds)

    print_error_ranges(ds)

    print_depth_distribution(ds)

    print_extreme_errors(ds)

    print("\nValidation checks complete.")


if __name__ == "__main__":
    main()