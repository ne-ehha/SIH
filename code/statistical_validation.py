import xarray as xr
import numpy as np
import pandas as pd


FILE = (
    "/Users/nehasreeraj/Desktop/oceanproject_SIH/"
    "processed/glorys_argo_collocation_2024.nc"
)


# ---------------------------------------------------------
# LOAD DATA
# ---------------------------------------------------------

def load_data():
    return xr.open_dataset(FILE)


# ---------------------------------------------------------
# BASIC METRICS
# ---------------------------------------------------------

def calculate_metrics(model, observation):

    model = np.asarray(model, dtype=float)
    observation = np.asarray(observation, dtype=float)

    valid = (
        np.isfinite(model)
        & np.isfinite(observation)
    )

    model = model[valid]
    observation = observation[valid]

    if len(model) == 0:
        return {
            "n": 0,
            "bias": np.nan,
            "mae": np.nan,
            "rmse": np.nan,
            "std": np.nan,
            "median_ae": np.nan,
            "correlation": np.nan,
            "centered_rmse": np.nan,
            "bias_ci_low": np.nan,
            "bias_ci_high": np.nan,
        }

    error = model - observation

    n = len(error)

    bias = np.mean(error)

    mae = np.mean(np.abs(error))

    rmse = np.sqrt(
        np.mean(error ** 2)
    )

    std = (
        np.std(error, ddof=1)
        if n > 1
        else 0.0
    )

    median_ae = np.median(
        np.abs(error)
    )

    # Pearson correlation.
    if n > 1 and np.std(model) > 0 and np.std(observation) > 0:
        correlation = np.corrcoef(
            model,
            observation
        )[0, 1]
    else:
        correlation = np.nan

    # Centered RMSE removes the mean bias.
    centered_error = error - bias

    centered_rmse = np.sqrt(
        np.mean(centered_error ** 2)
    )

    # Approximate 95% confidence interval for mean bias.
    if n > 1:
        standard_error = std / np.sqrt(n)

        bias_ci_low = (
            bias - 1.96 * standard_error
        )

        bias_ci_high = (
            bias + 1.96 * standard_error
        )

    else:
        bias_ci_low = np.nan
        bias_ci_high = np.nan

    return {
        "n": n,
        "bias": bias,
        "mae": mae,
        "rmse": rmse,
        "std": std,
        "median_ae": median_ae,
        "correlation": correlation,
        "centered_rmse": centered_rmse,
        "bias_ci_low": bias_ci_low,
        "bias_ci_high": bias_ci_high,
    }


# ---------------------------------------------------------
# OVERALL STATISTICS
# ---------------------------------------------------------

def overall_statistics(ds):

    print("\n" + "=" * 60)
    print("OVERALL MODEL–OBSERVATION STATISTICS")
    print("=" * 60)

    temp = calculate_metrics(
        ds.model_temperature.values,
        ds.argo_temperature.values
    )

    sal = calculate_metrics(
        ds.model_salinity.values,
        ds.argo_salinity.values
    )

    print("\nTEMPERATURE")
    print("-" * 40)

    print("N:", temp["n"])
    print("Bias:", temp["bias"])
    print("MAE:", temp["mae"])
    print("RMSE:", temp["rmse"])
    print("Std error:", temp["std"])
    print("Median absolute error:", temp["median_ae"])
    print("Correlation:", temp["correlation"])
    print("Centered RMSE:", temp["centered_rmse"])
    print(
        "95% bias CI:",
        temp["bias_ci_low"],
        "to",
        temp["bias_ci_high"]
    )

    print("\nSALINITY")
    print("-" * 40)

    print("N:", sal["n"])
    print("Bias:", sal["bias"])
    print("MAE:", sal["mae"])
    print("RMSE:", sal["rmse"])
    print("Std error:", sal["std"])
    print("Median absolute error:", sal["median_ae"])
    print("Correlation:", sal["correlation"])
    print("Centered RMSE:", sal["centered_rmse"])
    print(
        "95% bias CI:",
        sal["bias_ci_low"],
        "to",
        sal["bias_ci_high"]
    )


# ---------------------------------------------------------
# DEPTH STATISTICS
# ---------------------------------------------------------

def depth_statistics(ds):

    print("\n" + "=" * 60)
    print("DEPTH-STRATIFIED STATISTICS")
    print("=" * 60)

    df = ds[
        [
            "pressure",
            "model_temperature",
            "argo_temperature",
            "model_salinity",
            "argo_salinity",
        ]
    ].to_dataframe().reset_index()

    bins = [
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

    labels = [
        "0-10",
        "10-25",
        "25-50",
        "50-100",
        "100-200",
        "200-300",
        "300-400",
        "400-500",
    ]

    df["depth_bin"] = pd.cut(
        df["pressure"],
        bins=bins,
        labels=labels,
        include_lowest=True
    )

    print(
        "\n{:<12} {:>6} {:>10} {:>10} {:>10} {:>10} {:>10}".format(
            "Depth",
            "N",
            "T Bias",
            "T RMSE",
            "T r",
            "S Bias",
            "S RMSE"
        )
    )

    for depth, group in df.groupby(
        "depth_bin",
        observed=True
    ):

        temp = calculate_metrics(
            group.model_temperature,
            group.argo_temperature
        )

        sal = calculate_metrics(
            group.model_salinity,
            group.argo_salinity
        )

        print(
            "{:<12} {:>6} {:>10.3f} {:>10.3f} {:>10.3f} {:>10.3f} {:>10.3f}".format(
                str(depth),
                temp["n"],
                temp["bias"],
                temp["rmse"],
                temp["correlation"],
                sal["bias"],
                sal["rmse"],
            )
        )


# ---------------------------------------------------------
# TEMPORAL STATISTICS
# ---------------------------------------------------------

def temporal_statistics(ds):

    print("\n" + "=" * 60)
    print("TEMPORAL STATISTICS")
    print("=" * 60)

    df = ds[
        [
            "time",
            "model_temperature",
            "argo_temperature",
            "model_salinity",
            "argo_salinity",
        ]
    ].to_dataframe().reset_index()

    df["date"] = pd.to_datetime(
        df["time"]
    ).dt.date

    print(
        "\n{:<15} {:>6} {:>10} {:>10} {:>10} {:>10}".format(
            "Date",
            "N",
            "T Bias",
            "T RMSE",
            "S Bias",
            "S RMSE"
        )
    )

    for date, group in df.groupby("date"):

        temp = calculate_metrics(
            group.model_temperature,
            group.argo_temperature
        )

        sal = calculate_metrics(
            group.model_salinity,
            group.argo_salinity
        )

        print(
            "{:<15} {:>6} {:>10.3f} {:>10.3f} {:>10.3f} {:>10.3f}".format(
                str(date),
                temp["n"],
                temp["bias"],
                temp["rmse"],
                sal["bias"],
                sal["rmse"],
            )
        )


# ---------------------------------------------------------
# OUTLIER SENSITIVITY
# ---------------------------------------------------------

def outlier_statistics(ds):

    print("\n" + "=" * 60)
    print("OUTLIER SENSITIVITY")
    print("=" * 60)

    temp = ds.temperature_error.values
    sal = ds.salinity_error.values

    temp_mask = np.abs(temp) > 2
    sal_mask = np.abs(sal) > 1

    print("\nTemperature:")
    print(
        "Extreme observations:",
        int(np.sum(temp_mask))
    )

    print(
        "Percentage:",
        100 * np.mean(temp_mask)
    )

    print("\nSalinity:")
    print(
        "Extreme observations:",
        int(np.sum(sal_mask))
    )

    print(
        "Percentage:",
        100 * np.mean(sal_mask)
    )

    temp_all = np.sqrt(
        np.mean(temp ** 2)
    )

    temp_clean = np.sqrt(
        np.mean(temp[~temp_mask] ** 2)
    )

    sal_all = np.sqrt(
        np.mean(sal ** 2)
    )

    sal_clean = np.sqrt(
        np.mean(sal[~sal_mask] ** 2)
    )

    print("\nTemperature RMSE:")
    print("All:", temp_all)
    print(
        "Without |error| > 2°C:",
        temp_clean
    )

    print("\nSalinity RMSE:")
    print("All:", sal_all)
    print(
        "Without |error| > 1 PSU:",
        sal_clean
    )


# ---------------------------------------------------------
# DEPTH STRUCTURE
# ---------------------------------------------------------

def depth_pattern_check(ds):

    print("\n" + "=" * 60)
    print("DEPTH STRUCTURE CHECK")
    print("=" * 60)

    df = ds[
        [
            "pressure",
            "temperature_error",
            "salinity_error",
        ]
    ].to_dataframe().reset_index()

    temp_corr = df[
        ["pressure", "temperature_error"]
    ].corr().iloc[0, 1]

    sal_corr = df[
        ["pressure", "salinity_error"]
    ].corr().iloc[0, 1]

    print(
        "\nOverall depth vs temperature error:",
        temp_corr
    )

    print(
        "Overall depth vs salinity error:",
        sal_corr
    )

    print(
        "\nNote:"
    )

    print(
        "A weak overall correlation does not rule out "
        "layer-specific patterns."
    )


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

def main():

    print("Loading collocated dataset...")

    ds = load_data()

    overall_statistics(ds)

    depth_statistics(ds)

    temporal_statistics(ds)

    outlier_statistics(ds)

    depth_pattern_check(ds)

    print(
        "\nEnhanced statistical validation complete."
    )


if __name__ == "__main__":

    main()