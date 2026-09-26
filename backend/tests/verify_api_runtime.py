import requests
import json

base = "http://localhost:8000/api/v1/observations/discover"

test_cases = [
    {"name": "BGC + Chl-a", "platform": "BGC", "variable": "chl", "lat": 14.5, "lon": 87.2},
    {"name": "BGC + O2", "platform": "BGC", "variable": "o2", "lat": 14.5, "lon": 87.2},
    {"name": "BGC + NO3", "platform": "BGC", "variable": "no3", "lat": 14.5, "lon": 87.2},
    {"name": "GLIDER + Temperature", "platform": "GLIDER", "variable": "temperature", "lat": 13.9, "lon": 87.5},
    {"name": "GLIDER + Chl-a", "platform": "GLIDER", "variable": "chl", "lat": 13.9, "lon": 87.5},
    {"name": "GLIDER + Currents (Unavailable State)", "platform": "GLIDER", "variable": "currents", "lat": 13.9, "lon": 87.5},
    {"name": "CTD + Temperature", "platform": "CTD", "variable": "temperature", "lat": 12.8, "lon": 86.9},
    {"name": "CTD + Salinity", "platform": "CTD", "variable": "salinity", "lat": 12.8, "lon": 86.9},
    {"name": "CTD + NO3 (Unavailable State)", "platform": "CTD", "variable": "no3", "lat": 12.8, "lon": 86.9},
]

for tc in test_cases:
    print("=" * 70)
    print("DEMO TEST CASE:", tc["name"])
    params = {
        "platform": tc["platform"],
        "variable": tc["variable"],
        "latitude": tc["lat"],
        "longitude": tc["lon"],
        "data_mode": "HISTORICAL_RESEARCH"
    }
    r = requests.get(base, params=params)
    data = r.json()
    status = data.get("status")
    prof = data.get("selected_profile") or {}
    obs = data.get("observations", [])
    matching = data.get("matching") or {}
    prov = data.get("provenance") or {}

    p_type = prof.get("platform_type", "")
    p_id = prof.get("platform_id", "")
    prof_id = prof.get("profile_id", "")
    p_src = prov.get("source", prof.get("source", ""))
    av_vars = prof.get("available_variables", [])
    sp_off = matching.get("spatial_offset_km")
    temp_off = matching.get("temporal_offset_hours")
    sha256 = prov.get("sha256", prof.get("sha256", ""))
    file_path = prov.get("file_path", "")

    print(f"  * Platform: {tc['platform']}")
    print(f"  * Variable: {tc['variable']}")
    print(f"  * Status: {status}")
    print(f"  * Active Profile ID: {p_type} {p_id} ({prof_id})")
    print(f"  * Observation Source: {p_src}")
    print(f"  * Valid Observations Count: {len(obs)}")
    print(f"  * Available Variables in Profile: {av_vars}")
    print(f"  * Spatial Offset: {sp_off} km")
    print(f"  * Temporal Offset: {temp_off} hrs")
    print(f"  * Raw NetCDF File: {file_path}")
    print(f"  * SHA-256: {sha256}")
