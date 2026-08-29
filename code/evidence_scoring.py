import xarray as xr
import numpy as np
import pandas as pd


FILE = (
    "/Users/nehasreeraj/Desktop/oceanproject_SIH/"
    "processed/glorys_argo_collocation_2024.nc"
)


def load_data():
    return xr.open_dataset(FILE)


def calculate_statistics(values):
    values = np.asarray(values, dtype=float)
    values = values[np.isfinite(values)]

    n = len(values)

    if n == 0:
        return None

    bias = np.mean(values)
    std = np.std(values, ddof=1) if n > 1 else 0.0
    rmse = np.sqrt(np.mean(values ** 2))
    mae = np.mean(np.abs(values))
    median_ae = np.median(np.abs(values))

    if n > 1:
        se = std / np.sqrt(n)
        ci_low = bias - 1.96 * se
        ci_high = bias + 1.96 * se
    else:
        ci_low = np.nan
        ci_high = np.nan

    return {
        "n": n,
        "bias": bias,
        "std": std,
        "rmse": rmse,
        "mae": mae,
        "median_ae": median_ae,
        "ci_low": ci_low,
        "ci_high": ci_high,
    }


def evidence_rating(stats, meaningful_bias):
    """
    Conservative evidence rating.

    Strong:
        Large effect + adequate sample + CI excludes zero

    Moderate:
        Some evidence, but one component is weaker

    Weak:
        Small effect, small sample, or uncertain estimate
    """

    n = stats["n"]
    bias = abs(stats["bias"])
    ci_low = stats["ci_low"]
    ci_high = stats["ci_high"]

    effect = bias >= meaningful_bias

    ci_excludes_zero = (
        np.isfinite(ci_low)
        and np.isfinite(ci_high)
        and (ci_low > 0 or ci_high < 0)
    )

    if n >= 100 and effect and ci_excludes_zero:
        return "STRONG"

    if n >= 30 and effect and ci_excludes_zero:
        return "MODERATE"

    if n >= 30 and (
        effect or ci_excludes_zero
    ):
        return "MODERATE"

    return "WEAK"


def temperature_depth_analysis(ds):

    print("\n" + "=" * 60)
    print("TEMPERATURE DEPTH EVIDENCE")
    print("=" * 60)

    df = ds[
        [
            "pressure",
            "temperature_error"
        ]
    ].to_dataframe().reset_index()

    bins = [
        0, 10, 25, 50,
        100, 200, 300,
        400, 500
    ]

    labels = [
        "0-10",
        "10-25",
        "25-50",
        "50-100",
        "100-200",
        "200-300",
        "300-400",
        "400-500"
    ]

    df["depth_bin"] = pd.cut(
        df["pressure"],
        bins=bins,
        labels=labels,
        include_lowest=True
    )

    print(
        "\n{:<12} {:>6} {:>10} {:>10} {:>12}".format(
            "Depth",
            "N",
            "Bias",
            "RMSE",
            "Evidence"
        )
    )

    results = []

    for depth, group in df.groupby(
        "depth_bin",
        observed=True
    ):

        stats = calculate_statistics(
            group["temperature_error"]
        )

        rating = evidence_rating(
            stats,
            meaningful_bias=0.30
        )

        results.append({
            "depth": str(depth),
            **stats,
            "evidence": rating
        })

        print(
            "{:<12} {:>6} {:>10.3f} {:>10.3f} {:>12}".format(
                str(depth),
                stats["n"],
                stats["bias"],
                stats["rmse"],
                rating
            )
        )

    return pd.DataFrame(results)


def salinity_spatial_analysis(ds):

    print("\n" + "=" * 60)
    print("SALINITY SPATIAL EVIDENCE")
    print("=" * 60)

    df = ds[
        [
            "latitude",
            "longitude",
            "salinity_error"
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

        if len(group) < 20:
            continue

        stats = calculate_statistics(
            group["salinity_error"]
        )

        rating = evidence_rating(
            stats,
            meaningful_bias=0.50
        )

        results.append({
            "latitude": lat,
            "longitude": lon,
            **stats,
            "evidence": rating
        })

    result = pd.DataFrame(results)

    if len(result) == 0:
        print("\nNo spatial cells available.")
        return result

    result = result.sort_values(
        "bias",
        key=lambda x: x.abs(),
        ascending=False
    )

    print(
        "\n{:<8} {:<8} {:>6} {:>10} {:>12}".format(
            "Lat",
            "Lon",
            "N",
            "Bias",
            "Evidence"
        )
    )

    for _, row in result.head(10).iterrows():

        print(
            "{:<8.1f} {:<8.1f} {:>6} {:>10.3f} {:>12}".format(
                row["latitude"],
                row["longitude"],
                int(row["n"]),
                row["bias"],
                row["evidence"]
            )
        )

    return result


def outlier_analysis(ds):

    print("\n" + "=" * 60)
    print("OUTLIER EVIDENCE")
    print("=" * 60)

    temp = ds.temperature_error.values
    sal = ds.salinity_error.values

    temp_mask = np.abs(temp) > 2
    sal_mask = np.abs(sal) > 1

    print(
        "\nTemperature extreme observations:",
        int(np.sum(temp_mask))
    )

    print(
        "Temperature percentage:",
        f"{100 * np.mean(temp_mask):.2f}%"
    )

    print(
        "\nSalinity extreme observations:",
        int(np.sum(sal_mask))
    )

    print(
        "Salinity percentage:",
        f"{100 * np.mean(sal_mask):.2f}%"
    )

    print(
        "\nThese are investigation targets, "
        "not automatic bad-data flags."
    )


def main():

    print("Loading collocated dataset...")

    ds = load_data()

    temperature_depth_analysis(ds)

    salinity_spatial_analysis(ds)

    outlier_analysis(ds)

    print(
        "\nEvidence scoring complete."
    )


if __name__ == "__main__":
    main()