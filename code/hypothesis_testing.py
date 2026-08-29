import xarray as xr
import numpy as np


FILE = (
    "/Users/nehasreeraj/Desktop/oceanproject_SIH/"
    "processed/glorys_argo_collocation_2024.nc"
)


def load_data():
    return xr.open_dataset(FILE)


# ---------------------------------------------------------
# DATA HELPERS
# ---------------------------------------------------------

def depth_bias(ds, low, high):

    pressure = ds.pressure.values
    error = ds.temperature_error.values

    mask = (
        (pressure >= low)
        & (pressure < high)
        & np.isfinite(error)
    )

    if np.sum(mask) == 0:
        return np.nan, 0

    return (
        float(np.mean(error[mask])),
        int(np.sum(mask))
    )


def temporal_bias(ds):

    time = ds.time.values
    error = ds.temperature_error.values

    dates = np.array(
        [str(t)[:10] for t in time]
    )

    results = {}

    for date in np.unique(dates):

        mask = (
            (dates == date)
            & np.isfinite(error)
        )

        if np.sum(mask) == 0:
            continue

        results[date] = {
            "bias": float(
                np.mean(error[mask])
            ),
            "n": int(
                np.sum(mask)
            )
        }

    return results


# ---------------------------------------------------------
# HYPOTHESIS 1
# VERTICAL STRUCTURE / MIXING
# ---------------------------------------------------------

def evaluate_vertical_structure(ds):

    target_bias, target_n = depth_bias(
        ds,
        50,
        200
    )

    surface_bias, surface_n = depth_bias(
        ds,
        0,
        50
    )

    deep_bias, deep_n = depth_bias(
        ds,
        300,
        500
    )

    supporting = []
    contradicting = []
    missing = []

    if target_bias > 0.3:

        supporting.append(
            f"Large positive temperature bias "
            f"in the 50–200 dbar layer "
            f"(+{target_bias:.3f} °C, N={target_n})."
        )

    if abs(surface_bias) < 0.2:

        supporting.append(
            f"Surface bias is small "
            f"({surface_bias:+.3f} °C), "
            "indicating the discrepancy is not "
            "uniform through the water column."
        )

    if abs(deep_bias) < 0.2:

        supporting.append(
            f"Deep bias is small "
            f"({deep_bias:+.3f} °C), "
            "further supporting vertical localization."
        )

    # Nothing currently directly contradicts it,
    # but absence of diagnostics is not evidence for it.
    missing.extend([
        "Mixed-layer depth",
        "Vertical temperature gradient",
        "Potential-density stratification",
        "Vertical mixing / diffusivity diagnostics",
        "Surface heat-flux forcing",
    ])

    return {
        "name":
            "Upper-ocean vertical mixing / structure",

        "description":
            "Differences in the representation of "
            "upper-ocean vertical structure may "
            "contribute to the temperature discrepancy.",

        "supporting": supporting,

        "contradicting": contradicting,

        "missing": missing,

        "status":
            "PLAUSIBLE CANDIDATE — requires testing",

        "tests": [
            "Compare mixed-layer depth.",
            "Compare vertical temperature gradients.",
            "Compare density stratification.",
            "Compare vertical mixing diagnostics.",
            "Compare surface heat-flux forcing.",
        ]
    }


# ---------------------------------------------------------
# HYPOTHESIS 2
# SURFACE FORCING
# ---------------------------------------------------------

def evaluate_surface_forcing(ds):

    temporal = temporal_bias(ds)

    supporting = []
    contradicting = []
    missing = []

    # We only establish that bias varies over time.
    biases = [
        value["bias"]
        for value in temporal.values()
    ]

    if len(biases) >= 3:

        spread = max(biases) - min(biases)

        if spread > 0.3:

            supporting.append(
                f"Temperature bias varies by "
                f"{spread:.3f} °C across the "
                "available observation dates."
            )

    supporting.append(
        "The discrepancy is not perfectly constant "
        "through time."
    )

    missing.extend([
        "Surface heat flux",
        "Wind stress",
        "Air temperature",
        "Precipitation",
        "Evaporation",
        "Atmospheric forcing used by the model",
    ])

    contradicting.append(
        "Temporal variation alone does not demonstrate "
        "that surface forcing caused the discrepancy."
    )

    return {
        "name":
            "Surface forcing / atmospheric forcing",

        "description":
            "Differences in surface forcing could "
            "contribute to changes in model temperature.",

        "supporting": supporting,

        "contradicting": contradicting,

        "missing": missing,

        "status":
            "POSSIBLE — insufficient evidence",

        "tests": [
            "Compare model surface heat flux with "
            "an independent forcing product.",
            "Compare wind stress.",
            "Compare precipitation and evaporation.",
            "Check whether forcing anomalies coincide "
            "with temperature-bias changes.",
        ]
    }


# ---------------------------------------------------------
# HYPOTHESIS 3
# DATA / COLLOCATION ISSUE
# ---------------------------------------------------------

def evaluate_sampling(ds):

    supporting = []
    contradicting = []
    missing = []

    n = len(ds.pressure)

    if n > 1000:

        supporting.append(
            f"The analysis contains {n} matched "
            "observations, providing substantial "
            "sample size for the overall comparison."
        )

    supporting.append(
        "Argo observations are irregular in time "
        "and space, so sampling representativeness "
        "must be considered."
    )

    missing.extend([
        "Sensitivity to different temporal matching windows",
        "Sensitivity to different spatial matching windows",
        "Independent Argo profiles for replication",
        "Cross-validation using another observation period",
    ])

    contradicting.append(
        "The observed depth-dependent pattern is "
        "structured rather than a completely random "
        "error distribution."
    )

    return {
        "name":
            "Sampling / collocation effects",

        "description":
            "Some of the apparent discrepancy could "
            "result from spatial or temporal sampling "
            "differences between Argo and the model.",

        "supporting": supporting,

        "contradicting": contradicting,

        "missing": missing,

        "status":
            "ALTERNATIVE EXPLANATION — must be ruled out",

        "tests": [
            "Repeat collocation with tighter time windows.",
            "Repeat with different spatial windows.",
            "Repeat using additional Argo cycles.",
            "Test whether the depth pattern persists."
        ]
    }


# ---------------------------------------------------------
# HYPOTHESIS 4
# DATA ASSIMILATION / REANALYSIS EFFECT
# ---------------------------------------------------------

def evaluate_assimilation(ds):

    supporting = []
    contradicting = []
    missing = []

    target_bias, target_n = depth_bias(
        ds,
        50,
        200
    )

    if target_bias > 0.3:

        supporting.append(
            f"The discrepancy is concentrated "
            f"in a specific vertical layer "
            f"(50–200 dbar; N={target_n})."
        )

    missing.extend([
        "Assimilation increments",
        "Model background fields",
        "Assimilated observations",
        "Analysis increments by depth",
        "Model configuration information",
    ])

    contradicting.append(
        "No assimilation diagnostics are currently "
        "available, so an assimilation-related "
        "mechanism cannot be evaluated directly."
    )

    return {
        "name":
            "Data-assimilation / reanalysis effects",

        "description":
            "The discrepancy may be related to how "
            "observations are assimilated into the "
            "reanalysis system.",

        "supporting": supporting,

        "contradicting": contradicting,

        "missing": missing,

        "status":
            "POSSIBLE — currently untested",

        "tests": [
            "Inspect assimilation increments.",
            "Compare analysis and background fields "
            "if available.",
            "Check the influence of assimilated Argo data.",
            "Compare against an independent ocean product."
        ]
    }


# ---------------------------------------------------------
# REPORT
# ---------------------------------------------------------

def print_hypothesis(h):

    print("\n" + "=" * 60)

    print(
        "CANDIDATE:",
        h["name"]
    )

    print("=" * 60)

    print("\nDescription:")
    print(h["description"])

    print("\nStatus:")
    print(h["status"])

    print("\nSupporting evidence:")

    for item in h["supporting"]:
        print("  +", item)

    print("\nContradicting evidence / cautions:")

    for item in h["contradicting"]:
        print("  -", item)

    print("\nEvidence currently missing:")

    for item in h["missing"]:
        print("  ?", item)

    print("\nRecommended tests:")

    for item in h["tests"]:
        print("  →", item)


# ---------------------------------------------------------
# SUMMARY
# ---------------------------------------------------------

def print_summary(hypotheses):

    print("\n" + "=" * 60)
    print("RESEARCH INVESTIGATION SUMMARY")
    print("=" * 60)

    print(
        "\nThe system does NOT identify a single "
        "confirmed physical cause."
    )

    print(
        "Instead, it ranks candidate explanations "
        "according to currently available evidence."
    )

    print("\nCandidate explanations:")

    for h in hypotheses:

        print(
            f"\n• {h['name']}"
        )

        print(
            f"  Status: {h['status']}"
        )


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

def main():

    print("Loading collocated dataset...")

    ds = load_data()

    hypotheses = [
        evaluate_vertical_structure(ds),
        evaluate_surface_forcing(ds),
        evaluate_sampling(ds),
        evaluate_assimilation(ds),
    ]

    for hypothesis in hypotheses:
        print_hypothesis(hypothesis)

    print_summary(hypotheses)

    print(
        "\nHypothesis testing framework complete."
    )


if __name__ == "__main__":
    main()