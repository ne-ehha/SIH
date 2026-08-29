import xarray as xr
import numpy as np
import pandas as pd


FILE = (
    "/Users/nehasreeraj/Desktop/oceanproject_SIH/"
    "processed/glorys_argo_collocation_2024.nc"
)


def load_data():

    return xr.open_dataset(FILE)


def depth_analysis(ds):

    print("\n" + "=" * 60)
    print("DEPTH-DEPENDENT ERROR ANALYSIS")
    print("=" * 60)

    df = ds[
        [
            "pressure",
            "temperature_error",
            "salinity_error",
        ]
    ].to_dataframe().reset_index()

    bins = [0, 10, 25, 50, 100, 200, 300, 400, 500]

    df["depth_bin"] = pd.cut(
        df["pressure"],
        bins=bins,
        include_lowest=True
    )

    grouped = df.groupby(
        "depth_bin",
        observed=True
    )

    print(
        "\n{:<15} {:>8} {:>12} {:>12}".format(
            "Depth",
            "N",
            "Temp bias",
            "Sal bias"
        )
    )

    for depth, group in grouped:

        temp_bias = group.temperature_error.mean()
        sal_bias = group.salinity_error.mean()

        print(
            "{:<15} {:>8} {:>12.3f} {:>12.3f}".format(
                str(depth),
                len(group),
                temp_bias,
                sal_bias
            )
        )


def spatial_analysis(ds):

    print("\n" + "=" * 60)
    print("SPATIAL ERROR ANALYSIS")
    print("=" * 60)

    df = ds[
        [
            "latitude",
            "longitude",
            "temperature_error",
            "salinity_error",
        ]
    ].to_dataframe().reset_index()

    df["lat_bin"] = (
        np.floor(df["latitude"] * 2) / 2
    )

    df["lon_bin"] = (
        np.floor(df["longitude"] * 2) / 2
    )

    grouped = df.groupby(
        ["lat_bin", "lon_bin"]
    )

    results = []

    for (lat, lon), group in grouped:

        if len(group) < 5:
            continue

        results.append(
            {
                "latitude": lat,
                "longitude": lon,
                "n": len(group),
                "temperature_bias":
                    group.temperature_error.mean(),
                "salinity_bias":
                    group.salinity_error.mean(),
            }
        )

    result_df = pd.DataFrame(results)

    if len(result_df) == 0:

        print("\nNo spatial cells contain at least 5 observations.")

        return

    result_df["abs_temperature_bias"] = (
        result_df.temperature_bias.abs()
    )

    result_df["abs_salinity_bias"] = (
        result_df.salinity_bias.abs()
    )

    print("\nLargest temperature-bias cells:")

    print(
        result_df
        .sort_values(
            "abs_temperature_bias",
            ascending=False
        )
        .head(10)
        [
            [
                "latitude",
                "longitude",
                "n",
                "temperature_bias",
            ]
        ]
        .to_string(index=False)
    )

    print("\nLargest salinity-bias cells:")

    print(
        result_df
        .sort_values(
            "abs_salinity_bias",
            ascending=False
        )
        .head(10)
        [
            [
                "latitude",
                "longitude",
                "n",
                "salinity_bias",
            ]
        ]
        .to_string(index=False)
    )


def temporal_analysis(ds):

    print("\n" + "=" * 60)
    print("TEMPORAL ERROR ANALYSIS")
    print("=" * 60)

    df = ds[
        [
            "time",
            "temperature_error",
            "salinity_error",
        ]
    ].to_dataframe().reset_index()

    df["date"] = pd.to_datetime(
        df["time"]
    ).dt.date

    grouped = df.groupby("date")

    print(
        "\n{:<15} {:>8} {:>12} {:>12}".format(
            "Date",
            "N",
            "Temp bias",
            "Sal bias"
        )
    )

    for date, group in grouped:

        print(
            "{:<15} {:>8} {:>12.3f} {:>12.3f}".format(
                str(date),
                len(group),
                group.temperature_error.mean(),
                group.salinity_error.mean()
            )
        )


def outlier_analysis(ds):

    print("\n" + "=" * 60)
    print("OUTLIER ANALYSIS")
    print("=" * 60)

    temp = ds.temperature_error.values
    sal = ds.salinity_error.values

    temp_mask = np.abs(temp) > 2
    sal_mask = np.abs(sal) > 1

    print(
        "\nTemperature |error| > 2°C:",
        np.sum(temp_mask)
    )

    print(
        "Salinity |error| > 1 PSU:",
        np.sum(sal_mask)
    )

    print(
        "\nImportant:"
    )

    print(
        "These observations are flagged for investigation, "
        "not automatically removed."
    )


def main():

    print("Loading collocated data...")

    ds = load_data()

    depth_analysis(ds)

    spatial_analysis(ds)

    temporal_analysis(ds)

    outlier_analysis(ds)

    print(
        "\nPattern analysis complete."
    )


if __name__ == "__main__":

    main()