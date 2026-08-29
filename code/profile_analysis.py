import xarray as xr
import numpy as np
import gsw
import pandas as pd


COLLOCATED_FILE = (
    "/Users/nehasreeraj/Desktop/oceanproject_SIH/"
    "processed/glorys_argo_collocation_2024.nc"
)

GLORYS_FILE = (
    "/Users/nehasreeraj/Downloads/"
    "cmems_mod_glo_phy_my_0.083deg_P1D-m_1787938195229.nc"
)


def load_data():
    print("Loading collocated observations...")
    collocated = xr.open_dataset(COLLOCATED_FILE)

    print("Loading GLORYS...")
    glorys = xr.open_dataset(GLORYS_FILE)

    return collocated, glorys


def calculate_n2(depth, temperature, salinity, latitude, longitude):
    """
    Calculate TEOS-10 buoyancy frequency squared (N²).

    This uses the GLORYS temperature/salinity profile.
    """

    depth = np.asarray(depth, dtype=float)
    temperature = np.asarray(temperature, dtype=float)
    salinity = np.asarray(salinity, dtype=float)

    valid = (
        np.isfinite(depth)
        & np.isfinite(temperature)
        & np.isfinite(salinity)
    )

    depth = depth[valid]
    temperature = temperature[valid]
    salinity = salinity[valid]

    if len(depth) < 4:
        return None

    pressure = gsw.p_from_z(
        -depth,
        latitude
    )

    SA = gsw.SA_from_SP(
        salinity,
        pressure,
        longitude,
        latitude
    )

    CT = gsw.CT_from_pt(
        SA,
        temperature
    )

    # TEOS-10 buoyancy frequency squared
    N2, mid_pressure = gsw.Nsquared(
        SA,
        CT,
        pressure,
        latitude
    )

    mid_depth = -gsw.z_from_p(
        mid_pressure,
        latitude
    )

    return mid_depth, N2


def layer_mean(depth, values, low, high):

    mask = (
        (depth >= low)
        & (depth < high)
        & np.isfinite(values)
    )

    if np.sum(mask) == 0:
        return np.nan

    return float(np.mean(values[mask]))


def main():

    collocated, glorys = load_data()

    print("\n" + "=" * 60)
    print("PROFILE-LEVEL N² ANALYSIS")
    print("=" * 60)

    print(
        "\nPurpose:"
    )

    print(
        "Assess whether the model temperature discrepancy "
        "is consistently associated with modeled "
        "stratification across independent Argo profiles."
    )

    print(
        "\nScientific caution:"
    )

    print(
        "An association does not establish that "
        "stratification caused the model error."
    )

    # -----------------------------------------------------
    # GROUP BY ARGO PLATFORM + CYCLE
    # -----------------------------------------------------

    platforms = (
        collocated.platform_number.values
    )

    cycles = (
        collocated.cycle_number.values
    )

    unique_profiles = []

    for platform, cycle in zip(
        platforms,
        cycles
    ):

        unique_profiles.append(
            (
                str(platform),
                str(cycle)
            )
        )

    unique_profiles = list(
        dict.fromkeys(unique_profiles)
    )

    print(
        "\nIndependent platform/cycle combinations:",
        len(unique_profiles)
    )

    records = []

    # -----------------------------------------------------
    # PROFILE LOOP
    # -----------------------------------------------------

    for platform, cycle in unique_profiles:

        profile_mask = (
            (platforms.astype(str) == platform)
            & (cycles.astype(str) == cycle)
        )

        indices = np.where(
            profile_mask
        )[0]

        if len(indices) == 0:
            continue

        # Representative location/time
        i = indices[0]

        latitude = float(
            collocated.latitude.values[i]
        )

        longitude = float(
            collocated.longitude.values[i]
        )

        time = collocated.time.values[i]

        # Mean model-observation temperature error
        errors = (
            collocated.temperature_error.values[
                indices
            ]
        )

        errors = errors[
            np.isfinite(errors)
        ]

        if len(errors) == 0:
            continue

        profile_error = float(
            np.mean(errors)
        )

        # -------------------------------------------------
        # Extract nearest GLORYS profile
        # -------------------------------------------------

        try:

            model_profile = glorys.sel(
                time=time,
                latitude=latitude,
                longitude=longitude,
                method="nearest"
            )

            result = calculate_n2(
                model_profile.depth.values,
                model_profile.thetao.values,
                model_profile.so.values,
                latitude,
                longitude
            )

            if result is None:
                continue

            depth, N2 = result

            target_n2 = layer_mean(
                depth,
                N2,
                50,
                200
            )

            records.append({
                "platform": platform,
                "cycle": cycle,
                "latitude": latitude,
                "longitude": longitude,
                "time": time,
                "temperature_bias": profile_error,
                "N2_50_200": target_n2
            })

        except Exception as exc:

            print(
                f"Profile {platform}/{cycle} skipped: {exc}"
            )

    # -----------------------------------------------------
    # RESULTS
    # -----------------------------------------------------

    result = pd.DataFrame(records)

    print(
        "\nProfiles successfully analyzed:",
        len(result)
    )

    if len(result) < 3:

        print(
            "\nNot enough independent profiles "
            "for statistical analysis."
        )

        return

    print(
        "\n" + "=" * 60
    )

    print(
        "PROFILE-LEVEL RESULTS"
    )

    print(
        "=" * 60
    )

    print(
        "\n{:<14} {:>8} {:>14} {:>14}".format(
            "Platform/Cycle",
            "N",
            "Temp Bias",
            "Mean N²"
        )
    )

    for _, row in result.head(20).iterrows():

        print(
            "{:<14} {:>8} {:>14.3f} {:>14.4e}".format(
                f"{row['platform']}/{row['cycle']}",
                1,
                row["temperature_bias"],
                row["N2_50_200"]
                if np.isfinite(row["N2_50_200"])
                else np.nan
            )
        )

    # -----------------------------------------------------
    # CORRELATION
    # -----------------------------------------------------

    valid = (
        np.isfinite(
            result.temperature_bias
        )
        & np.isfinite(
            result.N2_50_200
        )
    )

    print(
        "\nIndependent profiles with valid N²:",
        int(np.sum(valid))
    )

    if np.sum(valid) >= 5:

        x = result.loc[
            valid,
            "temperature_bias"
        ].values

        y = result.loc[
            valid,
            "N2_50_200"
        ].values

        if (
            np.std(x) > 0
            and np.std(y) > 0
        ):

            correlation = np.corrcoef(
                x,
                y
            )[0, 1]

            print(
                "\nTemperature-bias vs "
                "50–200 dbar N² correlation:"
            )

            print(
                f"{correlation:.3f}"
            )

        else:

            print(
                "\nN² correlation cannot be calculated "
                "because there is insufficient variability."
            )

    # -----------------------------------------------------
    # PROFILE CONSISTENCY
    # -----------------------------------------------------

    print(
        "\n" + "=" * 60
    )

    print(
        "PROFILE CONSISTENCY"
    )

    print(
        "=" * 60
    )

    positive = result[
        result.temperature_bias > 0.3
    ]

    negative_or_small = result[
        result.temperature_bias <= 0.3
    ]

    print(
        "\nProfiles with temperature bias > +0.3°C:",
        len(positive)
    )

    print(
        "Profiles with bias <= +0.3°C:",
        len(negative_or_small)
    )

    if len(positive) > 0:

        print(
            "\nMean N² for profiles with "
            "bias > +0.3°C:"
        )

        print(
            positive.N2_50_200.mean()
        )

    if len(negative_or_small) > 0:

        print(
            "\nMean N² for profiles with "
            "bias <= +0.3°C:"
        )

        print(
            negative_or_small.N2_50_200.mean()
        )

    # -----------------------------------------------------
    # SCIENTIFIC INTERPRETATION
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
        "The 50–200 dbar temperature discrepancy "
        "is robust in the collocated dataset."
    )

    print(
        "\nNew test:"
    )

    print(
        "We have now examined the relationship "
        "at the independent Argo-profile level."
    )

    print(
        "\nImportant limitation:"
    )

    print(
        "A relationship between temperature bias "
        "and N² would be evidence of association, "
        "not proof of a mixing or stratification cause."
    )

    print(
        "\nPossible next investigations:"
    )

    print(
        "  → Compare complete Argo and GLORYS profiles."
    )

    print(
        "  → Compare mixed-layer depth."
    )

    print(
        "  → Examine vertical diffusivity/mixing diagnostics."
    )

    print(
        "  → Compare surface forcing."
    )

    print(
        "  → Repeat across additional months or years."
    )

    print(
        "\nProfile-level analysis complete."
    )


if __name__ == "__main__":
    main()