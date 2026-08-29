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
# METRICS
# ---------------------------------------------------------

def metrics(model, observation):

    model = np.asarray(model, dtype=float)
    observation = np.asarray(observation, dtype=float)

    valid = (
        np.isfinite(model)
        & np.isfinite(observation)
    )

    model = model[valid]
    observation = observation[valid]

    if len(model) == 0:
        return None

    error = model - observation

    bias = np.mean(error)

    mae = np.mean(np.abs(error))

    rmse = np.sqrt(
        np.mean(error ** 2)
    )

    if (
        len(model) > 1
        and np.std(model) > 0
        and np.std(observation) > 0
    ):
        correlation = np.corrcoef(
            model,
            observation
        )[0, 1]
    else:
        correlation = np.nan

    return {
        "n": len(error),
        "bias": bias,
        "mae": mae,
        "rmse": rmse,
        "correlation": correlation,
    }


# ---------------------------------------------------------
# DEPTH ANALYSIS
# ---------------------------------------------------------

def depth_analysis(ds):

    df = ds[
        [
            "pressure",
            "temperature_error",
            "salinity_error",
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
        "0-10 dbar",
        "10-25 dbar",
        "25-50 dbar",
        "50-100 dbar",
        "100-200 dbar",
        "200-300 dbar",
        "300-400 dbar",
        "400-500 dbar",
    ]

    df["depth_bin"] = pd.cut(
        df["pressure"],
        bins=bins,
        labels=labels,
        include_lowest=True
    )

    results = []

    for depth, group in df.groupby(
        "depth_bin",
        observed=True
    ):

        temp_error = group.temperature_error.values
        sal_error = group.salinity_error.values

        results.append(
            {
                "depth": str(depth),
                "n": len(group),
                "temperature_bias": np.mean(temp_error),
                "temperature_rmse": np.sqrt(
                    np.mean(temp_error ** 2)
                ),
                "salinity_bias": np.mean(sal_error),
                "salinity_rmse": np.sqrt(
                    np.mean(sal_error ** 2)
                ),
            }
        )

    return pd.DataFrame(results)


# ---------------------------------------------------------
# SPATIAL ANALYSIS
# ---------------------------------------------------------

def spatial_analysis(ds):

    df = ds[
        [
            "latitude",
            "longitude",
            "temperature_error",
            "salinity_error",
        ]
    ].to_dataframe().reset_index()

    # 0.5 degree exploratory cells.
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

    return pd.DataFrame(results)


# ---------------------------------------------------------
# TEMPORAL ANALYSIS
# ---------------------------------------------------------

def temporal_analysis(ds):

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

    results = []

    for date, group in grouped:

        results.append(
            {
                "date": date,
                "n": len(group),
                "temperature_bias":
                    group.temperature_error.mean(),
                "temperature_rmse":
                    np.sqrt(
                        np.mean(
                            group.temperature_error ** 2
                        )
                    ),
                "salinity_bias":
                    group.salinity_error.mean(),
                "salinity_rmse":
                    np.sqrt(
                        np.mean(
                            group.salinity_error ** 2
                        )
                    ),
            }
        )

    return pd.DataFrame(results)


# ---------------------------------------------------------
# FINDING: DEPTH PATTERN
# ---------------------------------------------------------

def detect_depth_pattern(depth_df):

    findings = []

    # Temperature layer of interest.
    target = depth_df[
        depth_df["depth"].isin(
            ["50-100 dbar", "100-200 dbar"]
        )
    ]

    surface = depth_df[
        depth_df["depth"].isin(
            ["0-10 dbar", "10-25 dbar", "25-50 dbar"]
        )
    ]

    deep = depth_df[
        depth_df["depth"].isin(
            ["300-400 dbar", "400-500 dbar"]
        )
    ]

    if len(target) > 0:

        target_n = target["n"].sum()

        target_bias = np.average(
            target["temperature_bias"],
            weights=target["n"]
        )

        target_rmse = np.sqrt(
            np.average(
                target["temperature_rmse"] ** 2,
                weights=target["n"]
            )
        )

        surface_bias = np.average(
            surface["temperature_bias"],
            weights=surface["n"]
        )

        deep_bias = np.average(
            deep["temperature_bias"],
            weights=deep["n"]
        )

        if (
            target_bias > 0.3
            and target_n >= 100
            and abs(surface_bias) < 0.2
            and abs(deep_bias) < 0.2
        ):

            findings.append(
                {
                    "type": "DEPTH_PATTERN",
                    "variable": "temperature",
                    "severity": "HIGH",
                    "finding":
                        "Positive temperature bias is concentrated "
                        "between 50 and 200 dbar.",
                    "evidence":
                        f"50-200 dbar weighted bias = "
                        f"{target_bias:.3f} °C; "
                        f"weighted RMSE = "
                        f"{target_rmse:.3f} °C; "
                        f"N = {target_n}. "
                        f"Surface/deep biases remain comparatively small.",
                    "interpretation":
                        "The pattern is consistent with a "
                        "layer-specific discrepancy in the "
                        "model representation of upper-ocean "
                        "thermal structure.",
                    "caution":
                        "This does not establish the physical cause."
                }
            )

    return findings


# ---------------------------------------------------------
# FINDING: SALINITY HOTSPOT
# ---------------------------------------------------------

def detect_spatial_pattern(spatial_df):

    findings = []

    if len(spatial_df) == 0:
        return findings

    # Largest absolute salinity bias.
    row = spatial_df.loc[
        spatial_df["salinity_bias"].abs().idxmax()
    ]

    if (
        abs(row["salinity_bias"]) >= 0.5
        and row["n"] >= 20
    ):

        findings.append(
            {
                "type": "SPATIAL_PATTERN",
                "variable": "salinity",
                "severity": "MEDIUM",
                "finding":
                    "A localized salinity-bias hotspot "
                    "was detected.",
                "evidence":
                    f"Approximate cell centered at "
                    f"{row['latitude']:.1f}°N, "
                    f"{row['longitude']:.1f}°E; "
                    f"bias = {row['salinity_bias']:.3f} PSU; "
                    f"N = {int(row['n'])}.",
                "interpretation":
                    "The discrepancy appears spatially "
                    "localized rather than uniformly distributed.",
                "caution":
                    "Spatial binning is exploratory; "
                    "the physical cause requires additional "
                    "oceanographic evidence."
            }
        )

    return findings


# ---------------------------------------------------------
# FINDING: TEMPORAL CHANGE
# ---------------------------------------------------------

def detect_temporal_pattern(time_df):

    findings = []

    if len(time_df) == 0:
        return findings

    # Require reasonable sample size.
    valid = time_df[
        time_df["n"] >= 30
    ].copy()

    if len(valid) < 3:
        return findings

    highest = valid.loc[
        valid["temperature_bias"].idxmax()
    ]

    lowest = valid.loc[
        valid["temperature_bias"].idxmin()
    ]

    if (
        highest["temperature_bias"]
        - lowest["temperature_bias"]
        > 0.3
    ):

        findings.append(
            {
                "type": "TEMPORAL_PATTERN",
                "variable": "temperature",
                "severity": "MEDIUM",
                "finding":
                    "Temperature bias changes substantially "
                    "over the observation period.",
                "evidence":
                    f"Maximum daily bias = "
                    f"{highest['temperature_bias']:.3f} °C "
                    f"on {highest['date']}; "
                    f"minimum = "
                    f"{lowest['temperature_bias']:.3f} °C "
                    f"on {lowest['date']}.",
                "interpretation":
                    "The model–observation discrepancy is "
                    "not temporally constant.",
                "caution":
                    "Sparse Argo sampling means temporal "
                    "patterns must be interpreted cautiously."
            }
        )

    return findings


# ---------------------------------------------------------
# FINDING: OUTLIERS
# ---------------------------------------------------------

def detect_outliers(ds):

    findings = []

    temp = ds.temperature_error.values
    sal = ds.salinity_error.values

    temp_count = np.sum(
        np.abs(temp) > 2
    )

    sal_count = np.sum(
        np.abs(sal) > 1
    )

    if temp_count > 0:

        findings.append(
            {
                "type": "OUTLIER",
                "variable": "temperature",
                "severity": "LOW",
                "finding":
                    "A small number of large temperature "
                    "discrepancies were detected.",
                "evidence":
                    f"{int(temp_count)} observations "
                    f"({100 * temp_count / len(temp):.2f}%) "
                    f"have |error| > 2 °C.",
                "interpretation":
                    "These observations warrant targeted "
                    "investigation.",
                "caution":
                    "They should not be automatically discarded."
            }
        )

    if sal_count > 0:

        findings.append(
            {
                "type": "OUTLIER",
                "variable": "salinity",
                "severity": "MEDIUM",
                "finding":
                    "A subset of salinity observations "
                    "contains large discrepancies.",
                "evidence":
                    f"{int(sal_count)} observations "
                    f"({100 * sal_count / len(sal):.2f}%) "
                    f"have |error| > 1 PSU.",
                "interpretation":
                    "These observations may contain useful "
                    "information about localized or unusual "
                    "model–observation disagreement.",
                "caution":
                    "Do not automatically classify these "
                    "as bad observations."
            }
        )

    return findings


# ---------------------------------------------------------
# PRINT DIAGNOSTIC REPORT
# ---------------------------------------------------------

def print_report(findings):

    print("\n" + "=" * 60)
    print("EVIDENCE-BASED DIAGNOSTIC REPORT")
    print("=" * 60)

    if len(findings) == 0:

        print(
            "\nNo diagnostic patterns met the current "
            "detection criteria."
        )

        return

    for number, finding in enumerate(
        findings,
        start=1
    ):

        print(
            f"\nFINDING #{number}"
        )

        print("-" * 60)

        print(
            "Type:",
            finding["type"]
        )

        print(
            "Variable:",
            finding["variable"]
        )

        print(
            "Severity:",
            finding["severity"]
        )

        print(
            "\nFinding:"
        )

        print(
            finding["finding"]
        )

        print(
            "\nEvidence:"
        )

        print(
            finding["evidence"]
        )

        print(
            "\nPossible interpretation:"
        )

        print(
            finding["interpretation"]
        )

        print(
            "\nScientific caution:"
        )

        print(
            finding["caution"]
        )


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

def main():

    print("Loading collocated dataset...")

    ds = load_data()

    print("Analyzing depth patterns...")

    depth_df = depth_analysis(ds)

    print("Analyzing spatial patterns...")

    spatial_df = spatial_analysis(ds)

    print("Analyzing temporal patterns...")

    temporal_df = temporal_analysis(ds)

    findings = []

    findings.extend(
        detect_depth_pattern(depth_df)
    )

    findings.extend(
        detect_spatial_pattern(spatial_df)
    )

    findings.extend(
        detect_temporal_pattern(temporal_df)
    )

    findings.extend(
        detect_outliers(ds)
    )

    print_report(findings)

    print(
        "\nDiagnostic analysis complete."
    )


if __name__ == "__main__":

    main()