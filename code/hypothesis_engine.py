import xarray as xr
import numpy as np


FILE = (
    "/Users/nehasreeraj/Desktop/oceanproject_SIH/"
    "processed/glorys_argo_collocation_2024.nc"
)


def load_data():
    return xr.open_dataset(FILE)


# ---------------------------------------------------------
# HELPER
# ---------------------------------------------------------

def weighted_mean(values, weights):
    values = np.asarray(values, dtype=float)
    weights = np.asarray(weights, dtype=float)

    valid = np.isfinite(values) & np.isfinite(weights)

    if not np.any(valid):
        return np.nan

    return np.average(
        values[valid],
        weights=weights[valid]
    )


# ---------------------------------------------------------
# TEMPERATURE DEPTH EVIDENCE
# ---------------------------------------------------------

def temperature_depth_evidence(ds):

    pressure = ds.pressure.values
    error = ds.temperature_error.values

    layers = {
        "surface (0–50 dbar)": (0, 50),
        "target layer (50–200 dbar)": (50, 200),
        "deep (300–500 dbar)": (300, 500),
    }

    results = {}

    for name, (low, high) in layers.items():

        mask = (
            (pressure >= low)
            & (pressure < high)
            & np.isfinite(error)
        )

        if np.sum(mask) == 0:
            results[name] = {
                "n": 0,
                "bias": np.nan
            }
        else:
            results[name] = {
                "n": int(np.sum(mask)),
                "bias": float(
                    np.mean(error[mask])
                )
            }

    return results


# ---------------------------------------------------------
# HYPOTHESIS 1
# ---------------------------------------------------------

def hypothesis_vertical_structure(ds):

    results = temperature_depth_evidence(ds)

    surface = results["surface (0–50 dbar)"]
    target = results["target layer (50–200 dbar)"]
    deep = results["deep (300–500 dbar)"]

    if target["n"] == 0:
        return None

    target_bias = target["bias"]
    surface_bias = surface["bias"]
    deep_bias = deep["bias"]

    difference_surface = (
        target_bias - surface_bias
    )

    difference_deep = (
        target_bias - deep_bias
    )

    support = []

    limitations = []

    if target_bias > 0.3:
        support.append(
            f"Target-layer temperature bias is "
            f"+{target_bias:.3f} °C."
        )

    if target["n"] >= 100:
        support.append(
            f"The target layer contains "
            f"{target['n']} matched observations."
        )

    if abs(surface_bias) < 0.2:
        support.append(
            f"Surface bias is comparatively small "
            f"({surface_bias:+.3f} °C)."
        )

    if abs(deep_bias) < 0.2:
        support.append(
            f"Deep-ocean bias is comparatively small "
            f"({deep_bias:+.3f} °C)."
        )

    if abs(difference_surface) > 0.3:
        support.append(
            "The discrepancy changes substantially "
            "between the surface and target layer."
        )

    limitations.append(
        "The present dataset demonstrates a "
        "model–observation discrepancy but does "
        "not identify its physical cause."
    )

    limitations.append(
        "Mixed-layer depth, stratification, surface "
        "forcing and vertical-mixing diagnostics "
        "have not yet been tested."
    )

    return {
        "title":
            "Possible upper-ocean vertical-structure discrepancy",

        "hypothesis":
            "Differences in the representation of "
            "upper-ocean vertical thermal structure "
            "may contribute to the observed temperature bias.",

        "confidence":
            "CANDIDATE — evidence-supported, "
            "not causally established",

        "support": support,

        "limitations": limitations,

        "next_tests": [
            "Compare mixed-layer depth between datasets.",
            "Compare vertical temperature gradients.",
            "Examine ocean stratification.",
            "Examine surface heat-flux or atmospheric forcing.",
            "Examine vertical-mixing diagnostics if available.",
            "Check whether the pattern persists across "
            "additional months or years."
        ]
    }


# ---------------------------------------------------------
# SALINITY SPATIAL HYPOTHESIS
# ---------------------------------------------------------

def salinity_spatial_evidence(ds):

    lat = ds.latitude.values
    lon = ds.longitude.values
    error = ds.salinity_error.values

    # Focus on the detected hotspot.
    mask = (
        (lat >= 13.25)
        & (lat < 13.75)
        & (lon >= 85.25)
        & (lon < 85.75)
        & np.isfinite(error)
    )

    return {
        "n": int(np.sum(mask)),
        "bias": (
            float(np.mean(error[mask]))
            if np.any(mask)
            else np.nan
        )
    }


def hypothesis_salinity_hotspot(ds):

    result = salinity_spatial_evidence(ds)

    if result["n"] == 0:
        return None

    support = []
    limitations = []

    if abs(result["bias"]) >= 0.5:
        support.append(
            f"The localized salinity bias is "
            f"{result['bias']:+.3f} PSU."
        )

    if result["n"] >= 30:
        support.append(
            f"The hotspot contains "
            f"{result['n']} matched observations."
        )

    limitations.append(
        "Spatial localization alone does not "
        "establish the physical mechanism."
    )

    limitations.append(
        "The current analysis does not yet include "
        "river discharge, precipitation, evaporation, "
        "surface fluxes or regional circulation diagnostics."
    )

    return {
        "title":
            "Possible localized salinity-process discrepancy",

        "hypothesis":
            "The localized salinity mismatch may be "
            "associated with regional processes or "
            "model representation that vary spatially.",

        "confidence":
            "CANDIDATE — spatial evidence present, "
            "mechanism unresolved",

        "support": support,

        "limitations": limitations,

        "next_tests": [
            "Examine nearby Argo profiles individually.",
            "Check whether the hotspot persists across cycles.",
            "Compare model and observation salinity profiles.",
            "Investigate freshwater influence.",
            "Examine precipitation and evaporation if available.",
            "Examine regional ocean circulation.",
            "Test the pattern using additional time periods."
        ]
    }


# ---------------------------------------------------------
# OUTLIER HYPOTHESIS
# ---------------------------------------------------------

def outlier_investigation(ds):

    temp = ds.temperature_error.values
    sal = ds.salinity_error.values

    temp_count = int(
        np.sum(np.abs(temp) > 2)
    )

    sal_count = int(
        np.sum(np.abs(sal) > 1)
    )

    return {
        "temperature": temp_count,
        "salinity": sal_count
    }


# ---------------------------------------------------------
# REPORT
# ---------------------------------------------------------

def print_hypothesis(report):

    print("\n" + "=" * 60)
    print("HYPOTHESIS & EVIDENCE REPORT")
    print("=" * 60)

    print("\n" + report["title"])

    print("\nCandidate hypothesis:")
    print(report["hypothesis"])

    print("\nEvidence status:")
    print(report["confidence"])

    print("\nSupporting evidence:")

    for item in report["support"]:
        print("  •", item)

    print("\nLimitations / evidence gaps:")

    for item in report["limitations"]:
        print("  •", item)

    print("\nRecommended investigation:")

    for item in report["next_tests"]:
        print("  •", item)


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

def main():

    print("Loading collocated dataset...")

    ds = load_data()

    reports = []

    temperature_report = (
        hypothesis_vertical_structure(ds)
    )

    salinity_report = (
        hypothesis_salinity_hotspot(ds)
    )

    if temperature_report is not None:
        reports.append(
            temperature_report
        )

    if salinity_report is not None:
        reports.append(
            salinity_report
        )

    for report in reports:
        print_hypothesis(report)

    outliers = outlier_investigation(ds)

    print("\n" + "=" * 60)
    print("OUTLIER INVESTIGATION TARGETS")
    print("=" * 60)

    print(
        "\nTemperature:",
        outliers["temperature"],
        "observations with |error| > 2 °C"
    )

    print(
        "Salinity:",
        outliers["salinity"],
        "observations with |error| > 1 PSU"
    )

    print(
        "\nThese remain investigation targets "
        "rather than automatically rejected observations."
    )

    print(
        "\nHypothesis analysis complete."
    )


if __name__ == "__main__":
    main()