import xarray as xr
import numpy as np
import pandas as pd


FILE = (
    "/Users/nehasreeraj/Desktop/oceanproject_SIH/"
    "processed/glorys_argo_collocation_2024.nc"
)


def load_data():
    return xr.open_dataset(FILE)


def depth_bias(ds, low, high):

    pressure = ds.pressure.values
    error = ds.temperature_error.values

    mask = (
        (pressure >= low)
        & (pressure < high)
        & np.isfinite(error)
    )

    if np.sum(mask) == 0:
        return np.nan, 0, np.nan

    values = error[mask]

    bias = np.mean(values)
    rmse = np.sqrt(np.mean(values ** 2))
    n = len(values)

    return bias, n, rmse


def calculate_depth_results(ds):

    layers = [
        ("0-50", 0, 50),
        ("50-100", 50, 100),
        ("100-200", 100, 200),
        ("200-300", 200, 300),
        ("300-500", 300, 500),
    ]

    results = []

    for name, low, high in layers:

        bias, n, rmse = depth_bias(
            ds,
            low,
            high
        )

        results.append(
            {
                "depth": name,
                "bias": bias,
                "rmse": rmse,
                "n": n
            }
        )

    return pd.DataFrame(results)


def bootstrap_bias(values, iterations=1000):

    values = np.asarray(values, dtype=float)
    values = values[np.isfinite(values)]

    if len(values) < 2:
        return np.nan, np.nan

    rng = np.random.default_rng(42)

    bootstrap_means = []

    for _ in range(iterations):

        sample = rng.choice(
            values,
            size=len(values),
            replace=True
        )

        bootstrap_means.append(
            np.mean(sample)
        )

    lower = np.percentile(
        bootstrap_means,
        2.5
    )

    upper = np.percentile(
        bootstrap_means,
        97.5
    )

    return lower, upper


def bootstrap_analysis(ds):

    print("\n" + "=" * 60)
    print("BOOTSTRAP UNCERTAINTY CHECK")
    print("=" * 60)

    pressure = ds.pressure.values
    error = ds.temperature_error.values

    mask = (
        (pressure >= 50)
        & (pressure < 200)
        & np.isfinite(error)
    )

    values = error[mask]

    lower, upper = bootstrap_bias(
        values
    )

    print(
        "\nTarget layer: 50–200 dbar"
    )

    print(
        "N:",
        len(values)
    )

    print(
        "Observed bias:",
        np.mean(values)
    )

    print(
        "Bootstrap 95% interval:",
        lower,
        "to",
        upper
    )

    if lower > 0:

        print(
            "\nResult:"
        )

        print(
            "The positive temperature bias remains "
            "above zero across the bootstrap interval."
        )

    else:

        print(
            "\nResult:"
        )

        print(
            "The bootstrap interval includes zero; "
            "evidence for a persistent positive bias "
            "is weaker."
        )


def depth_consistency(ds):

    print("\n" + "=" * 60)
    print("DEPTH PATTERN CONSISTENCY")
    print("=" * 60)

    results = calculate_depth_results(ds)

    print(
        "\n{:<12} {:>6} {:>12} {:>12}".format(
            "Depth",
            "N",
            "Bias",
            "RMSE"
        )
    )

    for _, row in results.iterrows():

        print(
            "{:<12} {:>6} {:>12.3f} {:>12.3f}".format(
                row["depth"],
                int(row["n"]),
                row["bias"],
                row["rmse"]
            )
        )

    target = results[
        results["depth"].isin(
            ["50-100", "100-200"]
        )
    ]

    surface = results[
        results["depth"] == "0-50"
    ]

    deep = results[
        results["depth"] == "300-500"
    ]

    target_bias = np.average(
        target["bias"],
        weights=target["n"]
    )

    surface_bias = surface["bias"].iloc[0]

    deep_bias = deep["bias"].iloc[0]

    print(
        "\nWeighted target-layer bias:",
        target_bias
    )

    print(
        "Surface bias:",
        surface_bias
    )

    print(
        "Deep bias:",
        deep_bias
    )

    if (
        target_bias > 0.3
        and abs(surface_bias) < 0.2
        and abs(deep_bias) < 0.2
    ):

        print(
            "\nPattern check:"
        )

        print(
            "The vertical structure remains clearly "
            "different between the target layer and "
            "surface/deep layers."
        )

    else:

        print(
            "\nPattern check:"
        )

        print(
            "The expected vertical contrast is weaker "
            "than the diagnostic threshold."
        )


def outlier_sensitivity(ds):

    print("\n" + "=" * 60)
    print("OUTLIER SENSITIVITY")
    print("=" * 60)

    error = ds.temperature_error.values

    normal = np.isfinite(error)

    all_values = error[normal]

    filtered = all_values[
        np.abs(all_values) <= 2
    ]

    rmse_all = np.sqrt(
        np.mean(all_values ** 2)
    )

    rmse_filtered = np.sqrt(
        np.mean(filtered ** 2)
    )

    print(
        "\nAll observations RMSE:",
        rmse_all
    )

    print(
        "Without |error| > 2°C:",
        rmse_filtered
    )

    print(
        "Number removed:",
        len(all_values) - len(filtered)
    )

    print(
        "\nInterpretation:"
    )

    print(
        "A small change in RMSE after removing "
        "extremes suggests the overall result is "
        "less sensitive to outliers."
    )


def main():

    print(
        "Loading collocated dataset..."
    )

    ds = load_data()

    depth_consistency(ds)

    bootstrap_analysis(ds)

    outlier_sensitivity(ds)

    print(
        "\nSensitivity analysis complete."
    )


if __name__ == "__main__":

    main()