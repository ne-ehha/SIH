# FINALIZED API CONTRACT v2.0

**Date:** 2026-08-30
**Status:** APPROVED — ready for Phase 2 implementation

---

## 1. ENDPOINT LIST

Base URL: `http://localhost:8000/api/v1`

| # | Method | Path | Pipeline | Purpose | Source Dataset |
|---|---|---|---|---|---|
| 1 | GET | `/health` | — | API status + dataset inventory | All |
| 2 | GET | `/datasets` | — | Dataset metadata and coverage | All |
| 3 | POST | `/comparison` | A | Model vs observation at a point | GLORYS×Argo collocation |
| 4 | POST | `/profile` | A | Vertical profile (model + observation) | GLORYS×Argo collocation |
| 5 | POST | `/discrepancy` | A | Error magnitude map for a region | GLORYS×Argo collocation |
| 6 | POST | `/observations` | A | Observation stations in a region | Argo DM |
| 7 | POST | `/diagnostics` | A | Diagnostic analysis at a point | GLORYS×Argo collocation |
| 8 | GET | `/diagnostics/{id}/workflow` | A | Investigation workflow | Computed from diagnostics |
| 9 | POST | `/visualization/3d` | B | 3D model visualization (8×8 grid per depth) | HYCOM 2026 |
| 10 | POST | `/model/profile` | B | Model-only vertical profile | HYCOM 2026 |
| 11 | POST | `/model/grid` | B | Model grid data for a region | HYCOM 2026 |

### Pipeline Separation

**Pipeline A — Scientific Comparison (GLORYS×Argo, Jan 2024):**
Provides model-observation comparison using temporally matched data.
- Model: GLORYS12V1 reanalysis
- Observation: Argo Delayed Mode
- Variables: `temperature`, `salinity` only
- Temporal coverage: Jan 1–14, 2024
- Spatial coverage: 8–15.5°N, 83.5–90.3°E

**Pipeline B — Model Exploration (HYCOM 2026):**
Provides model-only data for spatial visualization and exploration.
- Model: INCOIS HYCOM 2.35 operational forecast
- Observation: None (no temporally matched observations)
- Variables: `temperature`, `salinity`, `currents_u`, `currents_v`
- Temporal coverage: Aug 26 – Sep 1, 2026
- Spatial coverage: 5–22°N, 78–100°E

**These pipelines are never mixed.** HYCOM 2026 is never compared against Argo 2024.

---

## 2. REQUEST SCHEMAS

All requests: `Content-Type: application/json`

### POST `/api/v1/comparison`

```json
{
  "location": {
    "latitude": 12.5,         // required, number, -90 to 90
    "longitude": 87.3,        // required, number, -180 to 180
    "depth": 100              // required, number, meters, 0-500
  },
  "variable": "temperature",  // required, "temperature" | "salinity"
  "depth": 100,               // required, number, meters
  "date": "2024-01-10",       // required, YYYY-MM-DD
  "time": "12:00"             // required, HH:mm (24h)
}
```

Variable restriction: `temperature` and `salinity` only. Currents rejected with `UNSUPPORTED_VARIABLE`.

### POST `/api/v1/profile`

```json
{
  "location": {
    "latitude": 12.5,
    "longitude": 87.3
  },
  "variable": "temperature",  // required, "temperature" | "salinity"
  "date": "2024-01-10",
  "time": "12:00"
}
```

Variable restriction: `temperature` and `salinity` only.

### POST `/api/v1/discrepancy`

```json
{
  "region": "bay-of-bengal",  // required, string
  "bounds": {                  // required
    "north": 22.0,
    "south": 5.0,
    "east": 95.0,
    "west": 80.0
  },
  "variable": "temperature",  // required, "temperature" | "salinity"
  "date": "2024-01-10",
  "time": "12:00"
}
```

Variable restriction: `temperature` and `salinity` only.

### POST `/api/v1/observations`

```json
{
  "region": "bay-of-bengal",  // required
  "bounds": {                  // optional
    "north": 22.0,
    "south": 5.0,
    "east": 95.0,
    "west": 80.0
  },
  "date": "2024-01-10"        // required
}
```

### POST `/api/v1/diagnostics`

```json
{
  "location": {
    "latitude": 12.5,
    "longitude": 87.3,
    "depth": 100
  },
  "variable": "temperature",  // required, "temperature" | "salinity"
  "depth": 100,
  "date": "2024-01-10",
  "time": "12:00"
}
```

Variable restriction: `temperature` and `salinity` only.

### GET `/api/v1/diagnostics/{id}/workflow`

Path parameter: `id` (string) — diagnostic ID from prior `/diagnostics` response.

### POST `/api/v1/visualization/3d`

```json
{
  "location": {
    "latitude": 12.5,         // required
    "longitude": 87.3         // required
  },
  "variable": "temperature",  // required, all 4 variables supported
  "date": "2026-08-28",       // required, must be 2026-08-26 to 2026-09-01
  "time": "12:00"             // required, must be 00:00 | 06:00 | 12:00 | 18:00
}
```

All 4 variables supported: `temperature`, `salinity`, `currents_u`, `currents_v`.

### POST `/api/v1/model/profile`

```json
{
  "location": {
    "latitude": 12.5,
    "longitude": 87.3
  },
  "variable": "temperature",  // required, all 4 variables supported
  "date": "2026-08-28",       // required
  "time": "12:00"             // required
}
```

All 4 variables supported.

### POST `/api/v1/model/grid`

```json
{
  "bounds": {
    "north": 15.0,
    "south": 10.0,
    "east": 90.0,
    "west": 85.0
  },
  "variable": "temperature",  // required, all 4 variables supported
  "depth": 0,                 // required, one of: 0 | 17.5 | 52.5 | 125 | 275 | 500
  "date": "2026-08-28",
  "time": "12:00"
}
```

---

## 3. RESPONSE SCHEMAS

### 3.1 Envelope

**Success:**
```json
{
  "status": "success",
  "data": { /* endpoint-specific */ },
  "metadata": {
    "timestamp": "2026-08-30T12:00:00Z",
    "source": "api",
    "requestId": "req_abc123"
  }
}
```

**Error:**
```json
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

---

### 3.2 POST `/comparison` — Success (temperature or salinity)

**Source:** GLORYS×Argo collocation, Jan 2024

```json
{
  "status": "success",
  "data": {
    "point": {
      "modelValue": 22.15,
      "observationValue": 21.83,
      "difference": 0.32,
      "unit": "°C",
      "variable": "temperature",
      "depth": 100,
      "confidence": "high",
      "timestamp": "2024-01-10T12:00:00Z"
    },
    "healthScore": 85,
    "healthStatus": "good",
    "healthSummary": "GLORYS12V1 model temperature at 100m shows +0.32°C bias vs Argo observation. Bias within typical range for this region and depth.",
    "sourceModel": "GLORYS12V1",
    "sourceObservation": "Argo Delayed Mode"
  },
  "metadata": {
    "timestamp": "2026-08-30T12:00:00Z",
    "source": "api"
  }
}
```

Field details:

| Field | Type | Description |
|---|---|---|
| `point.modelValue` | number | GLORYS model value at requested location/depth/time |
| `point.observationValue` | number | Argo observation value at same location/depth/time |
| `point.difference` | number | `modelValue - observationValue` |
| `point.unit` | string | "°C" or "PSU" |
| `point.variable` | string | Echo of requested variable |
| `point.depth` | number | Actual matched depth (may differ slightly from request) |
| `point.confidence` | string | "high" (\|diff\| < 1°C or < 0.3PSU), "medium" (< 2°C or < 0.5PSU), "low" otherwise |
| `point.timestamp` | string | ISO 8601 of matched observation time |
| `healthScore` | number | 0–100. Temperature: `max(0, round(100 - \|diff\| × 20))`. Salinity: `max(0, round(100 - \|diff\| × 40))` |
| `healthStatus` | string | "excellent" (≥85), "good" (≥70), "fair" (≥50), "poor" (<50) |
| `healthSummary` | string | Human-readable. **Always names the model source and observation source.** |
| `sourceModel` | string | Always "GLORYS12V1" for this endpoint |
| `sourceObservation` | string | Always "Argo Delayed Mode" for this endpoint |

### 3.2b POST `/comparison` — Currents Rejected

```json
{
  "status": "error",
  "error": {
    "code": "UNSUPPORTED_VARIABLE",
    "message": "Variable 'currents_u' is not supported for model-observation comparison. Argo observations do not include ocean current measurements. Use /visualization/3d or /model/profile for model-only currents data."
  }
}
```

---

### 3.3 POST `/profile` — Success (temperature or salinity)

**Source:** GLORYS×Argo collocation, Jan 2024

```json
{
  "status": "success",
  "data": {
    "points": [
      { "depth": 0.5,   "modelValue": 27.12, "observationValue": 26.98, "unit": "°C" },
      { "depth": 10.0,  "modelValue": 26.85, "observationValue": 26.71, "unit": "°C" },
      { "depth": 50.0,  "modelValue": 24.30, "observationValue": 23.85, "unit": "°C" },
      { "depth": 100.0, "modelValue": 22.15, "observationValue": 21.83, "unit": "°C" },
      { "depth": 200.0, "modelValue": 16.42, "observationValue": 15.90, "unit": "°C" },
      { "depth": 445.0, "modelValue": 10.08, "observationValue": 10.02, "unit": "°C" }
    ],
    "variable": "temperature",
    "unit": "°C",
    "maxDepth": 500,
    "sourceModel": "GLORYS12V1",
    "sourceObservation": "Argo Delayed Mode",
    "temporalCoverage": "2024-01-01 to 2024-01-14"
  },
  "metadata": { "timestamp": "...", "source": "api" }
}
```

Points come from the collocation dataset at the observation's native pressure levels. Sorted by depth ascending.

### 3.3b POST `/profile` — Currents Rejected

Same `UNSUPPORTED_VARIABLE` error as `/comparison`.

---

### 3.4 POST `/discrepancy` — Success (temperature or salinity)

**Source:** GLORYS×Argo collocation, Jan 2024

```json
{
  "status": "success",
  "data": {
    "points": [
      { "latitude": 8.5,  "longitude": 85.2, "depth": 100, "errorMagnitude": 0.45, "variable": "temperature" },
      { "latitude": 12.0, "longitude": 87.5, "depth": 150, "errorMagnitude": 1.23, "variable": "temperature" }
    ],
    "stats": {
      "meanError": 0.32,
      "maxError": 2.15,
      "rmsError": 0.58,
      "totalPoints": 1220
    },
    "sourceModel": "GLORYS12V1",
    "sourceObservation": "Argo Delayed Mode",
    "temporalCoverage": "2024-01-01 to 2024-01-14"
  },
  "metadata": { "timestamp": "...", "source": "api" }
}
```

`errorMagnitude` = `abs(model - observation)`. Always non-negative. Points filtered by requested bounds/date.

---

### 3.5 POST `/observations` — Success

**Source:** Argo DM

```json
{
  "status": "success",
  "data": {
    "stations": [
      {
        "id": "argo_2902765_144",
        "latitude": 12.05,
        "longitude": 87.32,
        "timestamp": "2024-01-10T08:30:00Z",
        "depth": 200,
        "status": "active",
        "type": "argo",
        "temperature": 24.15,
        "salinity": 35.1
      }
    ],
    "totalActive": 8,
    "totalPending": 1,
    "region": "bay-of-bengal",
    "temporalCoverage": "2024-01-01 to 2024-01-14",
    "spatialCoverage": {
      "north": 15.52,
      "south": 7.80,
      "east": 90.26,
      "west": 83.47
    }
  },
  "metadata": { "timestamp": "...", "source": "api" }
}
```

Each unique (platform_number, cycle_number) pair = one station. `id` = `"argo_{cleaned_platform}_{cycle}"`. All stations are `type: "argo"`, `status: "active"`.

---

### 3.6 POST `/diagnostics` — Success

**Source:** GLORYS×Argo collocation analysis

```json
{
  "status": "success",
  "data": {
    "id": "diag_20260830_001",
    "errorFingerprint": "SUBSURFACE_WARM_BIAS_50_200DBAR",
    "possibleCauses": [
      {
        "name": "Vertical Mixing Parameterization",
        "confidence": "medium",
        "evidence": [
          "Subsurface temperature bias concentrated at 100m depth",
          "Surface temperature relatively accurate",
          "Persistent bias pattern across multiple time steps"
        ]
      },
      {
        "name": "Surface Forcing Error",
        "confidence": "low",
        "evidence": ["Wind stress or heat flux may be mis-specified"]
      },
      {
        "name": "Bathymetry Resolution",
        "confidence": "low",
        "evidence": ["Bathymetric features near the selected location may affect currents"]
      }
    ],
    "topCause": {
      "name": "Vertical Mixing Parameterization",
      "confidence": "medium",
      "evidence": [
        "Subsurface temperature bias concentrated at 100m depth",
        "Surface temperature relatively accurate",
        "Persistent bias pattern across multiple time steps"
      ]
    },
    "status": "complete",
    "sourceModel": "GLORYS12V1",
    "sourceObservation": "Argo Delayed Mode",
    "caution": "These are candidate explanations supported by available evidence. They do NOT establish physical causation."
  },
  "metadata": { "timestamp": "...", "source": "api" }
}
```

---

### 3.7 GET `/diagnostics/{id}/workflow` — Success

```json
{
  "status": "success",
  "data": {
    "steps": [
      { "id": "step-1", "title": "Detect",   "description": "Temperature bias detected at depth",          "status": "complete" },
      { "id": "step-2", "title": "Analyze",   "description": "Pattern consistent across multiple profiles", "status": "complete" },
      { "id": "step-3", "title": "Diagnose",  "description": "Possible causes identified",                  "status": "active" },
      { "id": "step-4", "title": "Solutions", "description": "Recommended experiments",                     "status": "inactive" },
      { "id": "step-5", "title": "Evaluate",  "description": "Compare results",                             "status": "inactive" }
    ],
    "solution": {
      "id": "sol-001",
      "recommendedTest": "Alternative vertical mixing configuration (k-ω vs k-ε)",
      "expectedOutcome": "Check whether subsurface temperature error decreases while surface accuracy is maintained",
      "caution": "This diagnostic analysis does not establish causality. Results should be validated against multiple independent observations.",
      "status": "inactive"
    }
  },
  "metadata": { "timestamp": "...", "source": "api" }
}
```

---

### 3.8 POST `/visualization/3d` — Success

**Source:** HYCOM 2026
**All 4 variables supported.**

#### 3.8a Temperature or Salinity (with observation context)

```json
{
  "status": "success",
  "data": {
    "variable": "temperature",
    "unit": "°C",
    "sourceModel": "INCOIS HYCOM 2.35",
    "sourceObservation": null,
    "observationNote": "Observation data not available for this variable and time period. Model-only visualization.",
    "date": "2026-08-28",
    "time": "12:00",
    "depthLevels": [0, 17.5, 52.5, 125, 275, 500],
    "depthSlices": [
      {
        "depth": 0,
        "meanValue": 28.35,
        "unit": "°C",
        "gridPoints": [
          { "latitude": 11.76, "longitude": 86.82, "value": 28.41, "unit": "°C" },
          { "latitude": 11.76, "longitude": 87.06, "value": 28.38, "unit": "°C" },
          { "latitude": 11.76, "longitude": 87.30, "value": 28.30, "unit": "°C" }
        ]
      },
      {
        "depth": 17.5,
        "meanValue": 28.10,
        "unit": "°C",
        "gridPoints": [ "... 64 entries ..." ]
      },
      {
        "depth": 52.5,
        "meanValue": 25.60,
        "unit": "°C",
        "gridPoints": [ "... 64 entries ..." ]
      },
      {
        "depth": 125,
        "meanValue": 19.80,
        "unit": "°C",
        "gridPoints": [ "... 64 entries ..." ]
      },
      {
        "depth": 275,
        "meanValue": 14.20,
        "unit": "°C",
        "gridPoints": [ "... 64 entries ..." ]
      },
      {
        "depth": 500,
        "meanValue": 10.05,
        "unit": "°C",
        "gridPoints": [ "... 64 entries ..." ]
      }
    ],
    "verticalProfile": [
      { "depth": 0,    "modelValue": 28.35, "observationValue": null, "unit": "°C" },
      { "depth": 17.5, "modelValue": 28.10, "observationValue": null, "unit": "°C" },
      { "depth": 52.5, "modelValue": 25.60, "observationValue": null, "unit": "°C" },
      { "depth": 125,  "modelValue": 19.80, "observationValue": null, "unit": "°C" },
      { "depth": 275,  "modelValue": 14.20, "observationValue": null, "unit": "°C" },
      { "depth": 500,  "modelValue": 10.05, "observationValue": null, "unit": "°C" }
    ]
  },
  "metadata": { "timestamp": "...", "source": "api" }
}
```

#### 3.8b Currents_u or Currents_v (observationValue OMITTED)

```json
{
  "status": "success",
  "data": {
    "variable": "currents_u",
    "unit": "m/s",
    "sourceModel": "INCOIS HYCOM 2.35",
    "sourceObservation": null,
    "observationNote": "Observation data unavailable for currents. Model-only visualization.",
    "date": "2026-08-28",
    "time": "12:00",
    "depthLevels": [0, 17.5, 52.5, 125, 275, 500],
    "depthSlices": [
      {
        "depth": 0,
        "meanValue": 0.35,
        "unit": "m/s",
        "gridPoints": [
          { "latitude": 11.76, "longitude": 86.82, "value": 0.38, "unit": "m/s" },
          { "latitude": 11.76, "longitude": 87.06, "value": 0.34, "unit": "m/s" },
          { "latitude": 11.76, "longitude": 87.30, "value": 0.31, "unit": "m/s" }
        ]
      },
      { "depth": 17.5,  "meanValue": 0.32, "unit": "m/s", "gridPoints": [ "..." ] },
      { "depth": 52.5,  "meanValue": 0.24, "unit": "m/s", "gridPoints": [ "..." ] },
      { "depth": 125,   "meanValue": 0.15, "unit": "m/s", "gridPoints": [ "..." ] },
      { "depth": 275,   "meanValue": 0.08, "unit": "m/s", "gridPoints": [ "..." ] },
      { "depth": 500,   "meanValue": 0.03, "unit": "m/s", "gridPoints": [ "..." ] }
    ],
    "verticalProfile": [
      { "depth": 0,    "modelValue": 0.35, "unit": "m/s" },
      { "depth": 17.5, "modelValue": 0.32, "unit": "m/s" },
      { "depth": 52.5, "modelValue": 0.24, "unit": "m/s" },
      { "depth": 125,  "modelValue": 0.15, "unit": "m/s" },
      { "depth": 275,  "modelValue": 0.08, "unit": "m/s" },
      { "depth": 500,  "modelValue": 0.03, "unit": "m/s" }
    ]
  },
  "metadata": { "timestamp": "...", "source": "api" }
}
```

**Critical:** `observationValue` is **absent** from `verticalProfile` entries. Not `null`, not `0` — the field does not exist in the JSON. Recharts handles `undefined` by skipping the observation line on the chart.

---

### 3.9 POST `/model/profile` — Success

**Source:** HYCOM 2026
**All 4 variables supported.**

#### 3.9a Temperature or Salinity

```json
{
  "status": "success",
  "data": {
    "points": [
      { "depth": 0,    "modelValue": 28.35, "observationValue": null, "unit": "°C" },
      { "depth": 17.5, "modelValue": 28.10, "observationValue": null, "unit": "°C" },
      { "depth": 52.5, "modelValue": 25.60, "observationValue": null, "unit": "°C" },
      { "depth": 125,  "modelValue": 19.80, "observationValue": null, "unit": "°C" },
      { "depth": 275,  "modelValue": 14.20, "observationValue": null, "unit": "°C" },
      { "depth": 500,  "modelValue": 10.05, "observationValue": null, "unit": "°C" }
    ],
    "variable": "temperature",
    "unit": "°C",
    "maxDepth": 500,
    "sourceModel": "INCOIS HYCOM 2.35",
    "sourceObservation": null,
    "observationNote": "Observation data not available for HYCOM 2026. Model-only profile.",
    "date": "2026-08-28",
    "time": "12:00"
  },
  "metadata": { "timestamp": "...", "source": "api" }
}
```

#### 3.9b Currents (observationValue OMITTED)

```json
{
  "status": "success",
  "data": {
    "points": [
      { "depth": 0,    "modelValue": 0.35, "unit": "m/s" },
      { "depth": 17.5, "modelValue": 0.32, "unit": "m/s" },
      { "depth": 52.5, "modelValue": 0.24, "unit": "m/s" },
      { "depth": 125,  "modelValue": 0.15, "unit": "m/s" },
      { "depth": 275,  "modelValue": 0.08, "unit": "m/s" },
      { "depth": 500,  "modelValue": 0.03, "unit": "m/s" }
    ],
    "variable": "currents_u",
    "unit": "m/s",
    "maxDepth": 500,
    "sourceModel": "INCOIS HYCOM 2.35",
    "sourceObservation": null,
    "observationNote": "Observation data unavailable for currents. Model-only profile.",
    "date": "2026-08-28",
    "time": "12:00"
  },
  "metadata": { "timestamp": "...", "source": "api" }
}
```

**`observationValue` is absent** from each `points` entry for currents.

---

### 3.10 POST `/model/grid` — Success

**Source:** HYCOM 2026
**All 4 variables supported.**

```json
{
  "status": "success",
  "data": {
    "variable": "temperature",
    "unit": "°C",
    "depth": 0,
    "date": "2026-08-28",
    "time": "12:00",
    "sourceModel": "INCOIS HYCOM 2.35",
    "gridPoints": [
      { "latitude": 10.13, "longitude": 85.26, "value": 28.41, "unit": "°C" },
      { "latitude": 10.13, "longitude": 85.50, "value": 28.38, "unit": "°C" },
      { "latitude": 10.13, "longitude": 85.74, "value": null,  "unit": "°C" }
    ],
    "gridInfo": {
      "latMin": 10.13,
      "latMax": 14.95,
      "lonMin": 85.02,
      "lonMax": 89.86,
      "latSpacing": 0.239,
      "lonSpacing": 0.240,
      "totalPoints": 400,
      "validPoints": 380,
      "landPoints": 20
    }
  },
  "metadata": { "timestamp": "...", "source": "api" }
}
```

`SurfaceGridPoint` has no `observationValue` field — no compatibility issue.

---

### 3.11 GET `/health` — Success

```json
{
  "status": "success",
  "data": {
    "api": "healthy",
    "datasets": {
      "hycom": {
        "available": true,
        "type": "model_forecast",
        "source": "INCOIS HYCOM 2.35",
        "temporalCoverage": { "start": "2026-08-26", "end": "2026-09-01" },
        "spatialCoverage": { "north": 21.943, "south": 5.063, "east": 99.86, "west": 78.02 },
        "depthLevels": [0, 17.5, 52.5, 125, 275, 500],
        "variables": ["temperature", "salinity", "currents_u", "currents_v"],
        "pipeline": "B"
      },
      "argo_dm": {
        "available": true,
        "type": "observation",
        "source": "Argo Delayed Mode (GDAC)",
        "temporalCoverage": { "start": "2024-01-01", "end": "2024-01-14" },
        "spatialCoverage": { "north": 15.52, "south": 7.80, "east": 90.26, "west": 83.47 },
        "totalProfiles": 27,
        "totalObservations": 4123,
        "validObservations": 1601,
        "variables": ["temperature", "salinity"],
        "pipeline": "A"
      },
      "glorys_argo_collocation": {
        "available": true,
        "type": "precomputed_match",
        "model": "GLORYS12V1",
        "observation": "Argo Delayed Mode",
        "temporalCoverage": { "start": "2024-01-01", "end": "2024-01-14" },
        "spatialCoverage": { "north": 15.52, "south": 7.80, "east": 90.26, "west": 83.47 },
        "totalMatches": 1220,
        "variables": ["temperature", "salinity"],
        "pipeline": "A"
      }
    },
    "pipelines": {
      "A": {
        "name": "Scientific Comparison",
        "model": "GLORYS12V1",
        "observation": "Argo DM",
        "variables": ["temperature", "salinity"],
        "temporalNote": "Jan 1-14, 2024 only"
      },
      "B": {
        "name": "Model Exploration",
        "model": "INCOIS HYCOM 2.35",
        "observation": null,
        "variables": ["temperature", "salinity", "currents_u", "currents_v"],
        "temporalNote": "Aug 26 - Sep 1, 2026 only. No temporally matched observations."
      }
    },
    "timestamp": "2026-08-30T12:00:00Z"
  }
}
```

---

## 4. DATASET AND SOURCE PER ENDPOINT

| Endpoint | Dataset | Model Source | Observation Source | Temporal Coverage | Spatial Coverage |
|---|---|---|---|---|---|
| POST `/comparison` | GLORYS×Argo collocation | GLORYS12V1 | Argo DM | Jan 1–14, 2024 | 8–15.5°N, 83.5–90.3°E |
| POST `/profile` | GLORYS×Argo collocation | GLORYS12V1 | Argo DM | Jan 1–14, 2024 | 8–15.5°N, 83.5–90.3°E |
| POST `/discrepancy` | GLORYS×Argo collocation | GLORYS12V1 | Argo DM | Jan 1–14, 2024 | 8–15.5°N, 83.5–90.3°E |
| POST `/observations` | Argo DM | — | Argo DM | Jan 1–14, 2024 | 8–15.5°N, 83.5–90.3°E |
| POST `/diagnostics` | GLORYS×Argo collocation | GLORYS12V1 | Argo DM | Jan 1–14, 2024 | 8–15.5°N, 83.5–90.3°E |
| POST `/visualization/3d` | HYCOM | INCOIS HYCOM 2.35 | None | Aug 26–Sep 1, 2026 | 5–22°N, 78–100°E |
| POST `/model/profile` | HYCOM | INCOIS HYCOM 2.35 | None | Aug 26–Sep 1, 2026 | 5–22°N, 78–100°E |
| POST `/model/grid` | HYCOM | INCOIS HYCOM 2.35 | None | Aug 26–Sep 1, 2026 | 5–22°N, 78–100°E |

---

## 5. VARIABLE SUPPORT MATRIX

| Variable | Pipeline A Comparison | Pipeline A Profile | Pipeline A Discrepancy | Pipeline B 3D Viz | Pipeline B Model Profile | Pipeline B Model Grid |
|---|---|---|---|---|---|---|
| `temperature` | ✅ model+obs | ✅ model+obs | ✅ error map | ✅ model+null obs | ✅ model+null obs | ✅ model grid |
| `salinity` | ✅ model+obs | ✅ model+obs | ✅ error map | ✅ model+null obs | ✅ model+null obs | ✅ model grid |
| `currents_u` | ❌ UNSUPPORTED | ❌ UNSUPPORTED | ❌ UNSUPPORTED | ✅ model only | ✅ model only | ✅ model grid |
| `currents_v` | ❌ UNSUPPORTED | ❌ UNSUPPORTED | ❌ UNSUPPORTED | ✅ model only | ✅ model only | ✅ model grid |

---

## 6. COORDINATE MATCHING

### HYCOM Grid (Pipeline B)

**Method:** Nearest-neighbour.

```python
idx_lat = argmin(abs(HYCOM_LAT - requested_lat))
idx_lon = argmin(abs(HYCOM_LON - requested_lon))
```

Grid spacing: ~0.239° lat × ~0.240° lon (~27 km). After selection, check for NaN (land). If NaN → `OUTSIDE_COVERAGE`.

For 8×8 grid: select 4 indices in each direction from the centre point. Grid points outside the domain are skipped. Land points included with `value: null`.

### Collocation Data (Pipeline A)

**Method:** Direct lookup. The collocation file contains pre-matched (model, observation) pairs at exact Argo locations. Filter by bounding box and date. No interpolation needed.

### Argo Data (Pipeline A)

**Method:** Spatial filtering. Filter by bounding box. For nearest lookups: Euclidean distance `sqrt((Δlat)² + (Δlon)²) × 111` km/degree.

---

## 7. TEMPORAL HANDLING

### HYCOM (Pipeline B)

| Property | Value |
|---|---|
| Timesteps | 24 (6-hourly) |
| Available times | 00:00, 06:00, 12:00, 18:00 UTC |
| Date range | 2026-08-26 to 2026-09-01 |

Matching: Requested date+time must match a HYCOM step. If time is off-cycle (e.g., "03:00"), snap to nearest available step. If date is outside range → `INVALID_DATE`.

### Collocation/Argo (Pipeline A)

Available dates: 2024-01-01, 04, 06, 07, 08, 09, 10, 11, 14 (9 dates). Requested date must match one of these. If not → `INVALID_DATE`.

---

## 8. DEPTH HANDLING

### HYCOM Depth Levels

| Level | Depth (m) |
|---|---|
| 1 | 0 |
| 2 | 17.5 |
| 3 | 52.5 |
| 4 | 125 |
| 5 | 275 |
| 6 | 500 |

These are the **only** available levels. No intermediate depths are generated.

- `/visualization/3d`: Returns all 6 levels. 8×8 grid at each = **384 grid points max**.
- `/model/profile`: Returns all 6 levels. `observationValue` absent for currents.
- `/model/grid`: Takes a single `depth` parameter. Must be one of these 6 values. Other values → `UNSUPPORTED_DEPTH`.

### Argo/Collocation Depth

Unstructured: 702 unique pressure levels in collocation data. Range: 0.5–445.1 dbar. 1 dbar ≈ 1 m.

- `/comparison`: Finds nearest collocation observation at requested depth. If none within ±10 dbar → `NO_DATA_AVAILABLE`.
- `/profile`: Returns all collocation observations at nearest location, sorted by depth.

---

## 9. MISSING-DATA HANDLING

### General Rules

- Never return `0`, `-999`, or fabricated values for missing data
- Use `null` in JSON for unavailable numeric values where the INTEG1 type allows it
- Use field omission (field absent from JSON) where `null` would cause a frontend crash
- Return structured error responses for query-level failures

### Specific Conventions

| Scenario | Representation |
|---|---|
| Land point in HYCOM grid | `"value": null` in grid point |
| Currents on comparison/profile endpoints | `UNSUPPORTED_VARIABLE` error — endpoint rejects the request |
| Currents on visualization/model endpoints | `observationValue` field **absent** from JSON (not null, not 0) |
| No collocation match at requested depth | `NO_DATA_AVAILABLE` error |
| Date outside coverage | `INVALID_DATE` error |
| Coordinate outside domain | `OUTSIDE_COVERAGE` error |

### Why Field Omission for Currents

The INTEG1 `VerticalProfilePoint.observationValue` is typed as `number` (not optional). The frontend `DifferenceCard` component calls `value.toFixed(2)` which crashes on `undefined`. By rejecting currents at comparison endpoints (where `DifferenceCard` is used) and omitting the field at visualization/model endpoints (where Recharts skips `undefined`), we avoid all crashes without modifying frontend code.

### Argo QC

The collocation dataset has already been filtered to QC="1" (good) observations. No additional QC filtering at query time.

---

## 10. 3D VISUALIZATION GRID STRUCTURE

### Grid Dimensions

| Component | Count | Notes |
|---|---|---|
| Depth slices | 6 | One per HYCOM depth level |
| Grid points per slice | 64 | 8×8 spatial grid |
| Total grid points | **384 max** | 6 × 64 |
| Vertical profile points | 6 | Model values at HYCOM depth levels |
| `depthLevels` entries | 6 | [0, 17.5, 52.5, 125, 275, 500] |

### Grid Generation

```
1. Find nearest HYCOM lat index → center_lat_idx
2. Find nearest HYCOM lon index → center_lon_idx
3. For each depth level in [0, 17.5, 52.5, 125, 275, 500]:
   For i in [center_lat_idx - 4 .. center_lat_idx + 3]:
     For j in [center_lon_idx - 4 .. center_lon_idx + 3]:
       lat = HYCOM_LAT[i]
       lon = HYCOM_LON[j]
       value = HYCOM_VAR[time, depth, i, j]
       If NaN (land) → { lat, lon, value: null, unit }
       If out of domain → skip
       Else → { lat, lon, value, unit }
```

Grid spacing matches HYCOM: ~0.24° in both directions.

### INTEG1 Adapter Compatibility

The `surfaceLayer` field in `Visualization3DResult` is populated with the surface depth slice's grid points (depth=0). The `depthSlices` array contains all 6 depth levels, each with their own `gridPoints`. The `verticalProfile` array contains model values at each HYCOM depth level. All field names match the INTEG1 types exactly.

---

## 11. ERROR CODES

| Code | HTTP | When | Example |
|---|---|---|---|
| `INVALID_COORDINATE` | 400 | Lat/lng out of range | "Latitude must be -90 to 90. Received: 95.0" |
| `OUTSIDE_COVERAGE` | 404 | Coordinate outside all dataset coverage | "Lat 3.0, Lon 75.0 outside all coverage areas" |
| `NO_MODEL_DATA` | 404 | Model value is NaN (land) | "No model data at Lat 10.5, Lon 85.0 — likely land" |
| `NO_OBSERVATION_DATA` | 404 | No observation at location/date | "No Argo observations near Lat 20.0, Lon 95.0 for 2024-01-10" |
| `NO_DATA_AVAILABLE` | 404 | Neither model nor observation | "No data at requested location, depth, and date" |
| `UNSUPPORTED_VARIABLE` | 400 | Variable not supported by endpoint | "Variable 'currents_u' not supported for comparison. Use /visualization/3d" |
| `UNSUPPORTED_DEPTH` | 400 | Depth not in HYCOM levels | "Depth 75.0 not available. Use: 0, 17.5, 52.5, 125, 275, 500" |
| `INVALID_DATE` | 400 | Date outside coverage | "Date 2025-06-15 outside HYCOM coverage (2026-08-26 to 2026-09-01)" |
| `INVALID_TIME` | 400 | Time not a dataset step | "Time 03:00 not a HYCOM step. Available: 00:00, 06:00, 12:00, 18:00" |
| `INVALID_PARAMETER` | 400 | Malformed request | "Missing required field: 'variable'" |
| `DATASET_UNAVAILABLE` | 503 | File not found/corrupted | "HYCOM dataset file not found" |
| `INTERNAL_ERROR` | 500 | Unexpected error | "Unexpected error processing request" |

---

## 12. INTEG1 COMPATIBILITY

### 12.1 Method Mapping

| INTEG1 Method | Backend Endpoint | Status |
|---|---|---|
| `fetchComparison()` | POST `/comparison` | ✅ Full |
| `fetchVerticalProfile()` | POST `/profile` or `/model/profile` | ✅ Full |
| `fetchDiscrepancy()` | POST `/discrepancy` | ✅ Full |
| `fetchObservations()` | POST `/observations` | ✅ Full |
| `fetchDiagnostics()` | POST `/diagnostics` | ✅ Full |
| `fetchWorkflow()` | GET `/diagnostics/{id}/workflow` | ✅ Full |
| `fetchVisualization()` | POST `/visualization/3d` | ✅ Full (currents: field omission) |

### 12.2 Currents Compatibility Detail

**`fetchVisualization()` for currents:**

The INTEG1 `VerticalProfilePoint` type requires `observationValue: number`. The backend omits this field from the JSON for currents. The data flow:

```
Backend JSON: { "depth": 0, "modelValue": 0.35, "unit": "m/s" }
                                                    ↑ observationValue absent
  ↓ apiClient.ts parses JSON
data.verticalProfile[0].observationValue === undefined (JS property access)
  ↓ ApiOceanDataProvider wraps as ProviderResponse
response.data.verticalProfile[0].observationValue === undefined
  ↓ adaptProfileForChart() — direct passthrough
ProfileChartPoint[0] = { depth: 0, modelValue: 0.35, observationValue: undefined }
  ↓ Recharts <Line dataKey="observationValue">
Recharts skips undefined values — observation line not drawn
  ↓ Result
Chart shows model-only line. No crash.
```

**`fetchComparison()` for currents:**

Returns `UNSUPPORTED_VARIABLE` error. The `useModelComparison` hook receives `response.status === 'error'`, sets the error string, and the UI displays it. The `DifferenceCard` component (which crashes on `undefined.toFixed()`) is never rendered.

### 12.3 Response Envelope Mapping

Backend HTTP response → `apiClient.ts` `ApiResponse<T>`:
```json
{ "status": "success", "data": { ... } }
```

→ `ApiOceanDataProvider` wraps as `ProviderResponse<T>`:
```json
{ "status": "success", "data": { ... }, "metadata": { "source": "api" } }
```

→ Adapters transform for UI components.

The `ApiOceanDataProvider` (Ayan's new code, registered as `api` provider) handles this mapping. No modifications to `MockOceanDataProvider`, adapters, hooks, or any Ilhan files.

### 12.4 No Frontend Modifications

The approach works within existing INTEG1 code because:
1. Comparison endpoints reject currents → error path, no data rendering
2. Visualization/model endpoints omit `observationValue` → Recharts handles `undefined`
3. Adapters are unmodified — they pass through what they receive
4. `ApiOceanDataProvider` routes currents to the correct endpoints

---

## 13. DECISIONS INCORPORATED

| Decision | How Applied |
|---|---|
| Temporal mismatch | Two pipelines. Pipeline A: GLORYS×Argo (2024). Pipeline B: HYCOM (2026). Never mixed. `sourceModel` always in responses. |
| Currents model-only | Comparison endpoints reject with `UNSUPPORTED_VARIABLE`. Viz/model endpoints omit `observationValue` from JSON. `observationNote` metadata explains. |
| 3D visualization | 8×8 grid at each of 6 actual HYCOM depth levels. 384 grid points max. No artificial depths. Land points = `value: null`. |
| INTEG1 compatibility | Full mapping documented. Currents field omission verified safe through adapter→Recharts data flow. |
| Dataset/source provenance | `sourceModel`, `sourceObservation`, `observationNote`, pipeline labels in health endpoint. |

---

**END OF FINALIZED API CONTRACT v2.0**

**Approved. Ready for Phase 2 implementation.**
