import xarray as xr
import numpy as np
import gsw


COLLOCATED_FILE = (
    "/Users/nehasreeraj/Desktop/oceanproject_SIH/"
    "processed/glorys_argo_collocation_2024.nc"
)

GLORYS_FILE = (
    "/Users/nehasreeraj/Downloads/"
    "cmems_mod_glo_phy_my_0.083deg_P1D-m_1787938195229.nc"
)


# ---------------------------------------------------------
# LOAD
# ---------------------------------------------------------

def load_data():

    print("Loading collocated observations...")
    collocated = xr.open_dataset(COLLOCATED_FILE)

    print("Loading GLORYS...")
    glorys = xr.open_dataset(GLORYS_FILE)

    return collocated, glorys


# ---------------------------------------------------------
# TEOS-10 PROFILE
# ---------------------------------------------------------

def calculate_teos10_profile(
    depth,
    latitude,
    longitude,
    temperature,
    salinity
):

    depth = np.asarray(depth, dtype=float)
    temperature = np.asarray(
        temperature,
        dtype=float
    )
    salinity = np.asarray(
        salinity,
        dtype=float
    )

    valid = (
        np.isfinite(depth)
        & np.isfinite(temperature)
        & np.isfinite(salinity)
    )

    depth = depth[valid]
    temperature = temperature[valid]
    salinity = salinity[valid]

    if len(depth) < 3:
        return None

    # GLORYS depth is positive downward.
    # TEOS-10 pressure requires latitude.
    pressure = gsw.p_from_z(
        -depth,
        latitude
    )

    # Practical Salinity -> Absolute Salinity
    SA = gsw.SA_from_SP(
        salinity,
        pressure,
        longitude,
        latitude
    )

    # Potential temperature -> Conservative Temperature
    CT = gsw.CT_from_pt(
        SA,
        temperature
    )

    # In-situ density
    rho = gsw.rho(
        SA,
        CT,
        pressure
    )

    # Vertical density gradient
    density_gradient = np.gradient(
        rho,
        depth
    )

    # Vertical temperature gradient
    temperature_gradient = np.gradient(
        temperature,
        depth
    )

    return {
        "depth": depth,
        "pressure": pressure,
        "SA": SA,
        "CT": CT,
        "rho": rho,
        "density_gradient": density_gradient,
        "temperature_gradient": temperature_gradient
    }


# ---------------------------------------------------------
# LAYER MEAN
# ---------------------------------------------------------

def layer_mean(
    depth,
    values,
    low,
    high
):

    mask = (
        (depth >= low)
        & (depth < high)
        & np.isfinite(values)
    )

    if np.sum(mask) == 0:
        return np.nan, 0

    return (
        float(np.mean(values[mask])),
        int(np.sum(mask))
    )


# ---------------------------------------------------------
# PROFILE EXTRACTION
# ---------------------------------------------------------

def get_profile(
    glorys,
    time,
    latitude,
    longitude
):

    return glorys.sel(
        time=time,
        latitude=latitude,
        longitude=longitude,
        method="nearest"
    )


# ---------------------------------------------------------
# MAIN ANALYSIS
# ---------------------------------------------------------

def analyze_profiles(
    collocated,
    glorys,
    max_profiles=100
):

    print("\n" + "=" * 60)
    print("TEOS-10 CONTEXTUAL DIAGNOSTICS")
    print("=" * 60)

    print(
        "\nPurpose:"
    )

    print(
        "Test whether the observed temperature "
        "discrepancy is associated with modeled "
        "vertical thermal or density structure."
    )

    print(
        "\nScientific caution:"
    )

    print(
        "A statistical association does not establish "
        "that stratification or mixing caused the error."
    )

    n = min(
        max_profiles,
        len(collocated.time)
    )

    records = []

    print(
        f"\nExamining up to {n} matched profiles..."
    )

    for i in range(n):

        time = collocated.time.values[i]
        latitude = float(
            collocated.latitude.values[i]
        )
        longitude = float(
            collocated.longitude.values[i]
        )

        try:

            profile = get_profile(
                glorys,
                time,
                latitude,
                longitude
            )

            result = calculate_teos10_profile(
                profile.depth.values,
                latitude,
                longitude,
                profile.thetao.values,
                profile.so.values
            )

            if result is None:
                continue

            depth = result["depth"]

            temp_gradient = (
                result["temperature_gradient"]
            )

            density_gradient = (
                result["density_gradient"]
            )

            temp_grad_target, temp_n = (
                layer_mean(
                    depth,
                    temp_gradient,
                    50,
                    200
                )
            )

            density_grad_target, density_n = (
                layer_mean(
                    depth,
                    density_gradient,
                    50,
                    200
                )
            )

            records.append({
                "temperature_error":
                    float(
                        collocated.temperature_error.values[i]
                    ),

                "temperature_gradient":
                    temp_grad_target,

                "density_gradient":
                    density_grad_target,

                "temp_n":
                    temp_n,

                "density_n":
                    density_n
            })

        except Exception as exc:

            print(
                f"Profile {i} skipped: {exc}"
            )

    print(
        "\nProfiles successfully processed:",
        len(records)
    )

    if len(records) < 3:

        print(
            "\nNot enough valid profiles "
            "for correlation analysis."
        )

        return

    errors = np.array([
        r["temperature_error"]
        for r in records
    ])

    temp_gradients = np.array([
        r["temperature_gradient"]
        for r in records
    ])

    density_gradients = np.array([
        r["density_gradient"]
        for r in records
    ])

    # -----------------------------------------------------
    # TEMPERATURE GRADIENT
    # -----------------------------------------------------

    valid_temp = (
        np.isfinite(errors)
        & np.isfinite(temp_gradients)
    )

    print(
        "\n" + "=" * 60
    )

    print(
        "THERMAL STRUCTURE ASSOCIATION"
    )

    print(
        "=" * 60
    )

    if np.sum(valid_temp) >= 3:

        x = errors[valid_temp]
        y = temp_gradients[valid_temp]

        if (
            np.std(x) > 0
            and np.std(y) > 0
        ):

            correlation = np.corrcoef(
                x,
                y
            )[0, 1]

            print(
                "\nTemperature-error vs "
                "50–200 dbar temperature-gradient correlation:"
            )

            print(
                f"{correlation:.3f}"
            )

        else:

            print(
                "\nTemperature-gradient correlation:"
            )

            print(
                "Not computable because one variable "
                "has insufficient variability."
            )

    # -----------------------------------------------------
    # DENSITY STRATIFICATION
    # -----------------------------------------------------

    valid_density = (
        np.isfinite(errors)
        & np.isfinite(density_gradients)
    )

    print(
        "\n" + "=" * 60
    )

    print(
        "DENSITY STRATIFICATION ASSOCIATION"
    )

    print(
        "=" * 60
    )

    if np.sum(valid_density) >= 3:

        x = errors[valid_density]
        y = density_gradients[valid_density]

        if (
            np.std(x) > 0
            and np.std(y) > 0
        ):

            correlation = np.corrcoef(
                x,
                y
            )[0, 1]

            print(
                "\nTemperature-error vs "
                "50–200 dbar density-gradient correlation:"
            )

            print(
                f"{correlation:.3f}"
            )

        else:

            print(
                "\nDensity-gradient correlation:"
            )

            print(
                "Not computable because one variable "
                "has insufficient variability."
            )

    # -----------------------------------------------------
    # INTERPRETATION
    # -----------------------------------------------------

    print(
        "\n" + "=" * 60
    )

    print(
        "SCIENTIFIC INTERPRETATION"
    )

    print(
        "=" * 60
    )

    print(
        "\nObserved:"
    )

    print(
        "A robust positive temperature discrepancy "
        "has already been detected in the 50–200 dbar layer."
    )

    print(
        "\nWhat this analysis can test:"
    )

    print(
        "Whether that discrepancy is statistically "
        "associated with vertical thermal or density structure."
    )

    print(
        "\nWhat it cannot establish:"
    )

    print(
        "A correlation cannot prove that vertical mixing, "
        "stratification, or another physical process caused "
        "the model error."
    )

    print(
        "\nPossible next investigations:"
    )

    print(
        "  → Compare Argo and GLORYS full vertical profiles."
    )

    print(
        "  → Calculate mixed-layer depth."
    )

    print(
        "  → Examine buoyancy frequency (N²)."
    )

    print(
        "  → Examine vertical mixing diagnostics."
    )

    print(
        "  → Compare surface forcing."
    )

    print(
        "  → Repeat using additional observation periods."
    )

    print(
        "\nTEOS-10 contextual diagnostics complete."
    )


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

def main():

    collocated, glorys = load_data()

    analyze_profiles(
        collocated,
        glorys,
        max_profiles=100
    )


if __name__ == "__main__":
    main()