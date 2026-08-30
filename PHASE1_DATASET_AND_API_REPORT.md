# PHASE 1 REPORT — Dataset Inspection, INTEG1 Contract Mapping, and API Design

**Date:** 2026-08-30
**Author:** Ayan (Backend)
**Status:** COMPLETE — awaiting review before implementation

---

## TABLE OF CONTENTS

1. [Actual Datasets Available](#1-actual-datasets-available)
2. [Dataset Formats](#2-dataset-formats)
3. [Dataset Dimensions](#3-dataset-dimensions)
4. [Variables](#4-variables)
5. [Units](#5-units)
6. [Spatial Coverage](#6-spatial-coverage)
7. [Temporal Coverage](#7-temporal-coverage)
8. [Depth Coverage](#8-depth-coverage)
9. [Missing-Data Conventions](#9-missing-data-conventions)
10. [Model/Observation Classification](#10-modelobservation-classification)
11. [Coordinate Query Strategy](#11-coordinate-query-strategy)
12. [Model-Observation Matching](#12-model-observation-matching)
13. [Exact INTEG1 Operations Discovered](#13-exact-integ1-operations-discovered)
14. [Proposed API Endpoints](#14-proposed-api-endpoints)
15. [Proposed Request Schemas](#15-proposed-request-schemas)
16. [Proposed Response Schemas](#16-proposed-response-schemas)
17. [Mismatches Between Datasets and INTEG1](#17-mismatches-between-datasets-and-integ1)
18. [Scientific Limitations](#18-scientific-limitations)
19. [Recommended Implementation Order](#19-recommended-implementation-order)

---

## 1. ACTUAL DATASETS AVAILABLE

| # | Dataset Name | File Path | Type |
|---|---|---|---|
| 1 | INCOIS HYCOM 2.35 | `RSMC_hycom_20260827.nc` | Model/Forecast |
| 2 | Argo Delayed Mode (BOB 2024) | `argo_dm_BOB_2024.nc` | Observation |
| 3 | Argo DM Index | `argo_dm_BOB_index.csv` | Metadata/Index |
| 4 | GLORYS-Argo Collocation | `processed/glorys_argo_collocation_2024.nc` | Pre-computed Model-Obs Match |

**Note:** The GLORYS12V1 reanalysis model file (`GLORY/cmems_mod_glo_phy_my_0.083deg_P1D-m_1787938195229.nc`) referenced in `code/model_loader.py` and `code/collocation.py` is **NOT present** in the repository (it is `.gitignore`d due to size). The collocation output is present.

---

## 2. DATASET FORMATS

| Dataset | Format | Library | Engine | File Size |
|---|---|---|---|---|
| HYCOM | NetCDF-3/CF-1.6 | xarray | netCDF4 | 16 MB |
| Argo DM | NetCDF-4 | xarray | netCDF4 | 726 KB |
| Argo Index | CSV | pandas | csv | ~2 KB |
| Collocation | NetCDF-4 | xarray | netCDF4 | 176 KB |

All NetCDF files can be accessed with `xarray.open_dataset()` for lazy/indexed access.

---

## 3. DATASET DIMENSIONS

### 3.1 HYCOM (`RSMC_hycom_20260827.nc`)

| Dimension | Size | Coordinate Name | Notes |
|---|---|---|---|
| TIME | 24 | `TIME` | datetime64[ns], 6-hourly |
| DEPTH | 6 | `DEPTH` | float32, unevenly spaced |
| LAT | 74 | `LAT` | float32 |
| LON | 92 | `LON` | float32 |

Data variables: `TEMP`, `SALN`, `UVEL`, `VVEL` — all shape `(TIME, DEPTH, LAT, LON)`
Plus bounds variables: `DEPTH_bounds`, `LAT_bounds`

### 3.2 Argo DM (`argo_dm_BOB_2024.nc`)

| Dimension | Size | Notes |
|---|---|---|
| observation | 4123 | Unstructured — individual profile levels |

No gridded coordinates. Each row is one observation at one depth level from one Argo profile.

### 3.3 GLORYS-Argo Collocation (`processed/glorys_argo_collocation_2024.nc`)

| Dimension | Size | Notes |
|---|---|---|
| observation | 1220 | Pre-matched model-observation pairs |

Same unstructured format as Argo. Each row has both model and observation values at the same location/time/depth.

---

## 4. VARIABLES

### 4.1 HYCOM

| Variable | NetCDF Name | Long Name | Standard Name | Dimensions | Data Type |
|---|---|---|---|---|---|
| Temperature | `TEMP` | TEMP | — | TIME×DEPTH×LAT×LON | float32 |
| Salinity | `SALN` | SALN | — | TIME×DEPTH×LAT×LON | float32 |
| Eastward Current | `UVEL` | eastward current | eastward_current | TIME×DEPTH×LAT×LON | float32 |
| Northward Current | `VVEL` | northward current | northward_current | TIME×DEPTH×LAT×LON | float32 |

### 4.2 Argo DM

| Variable | NetCDF Name | Dimensions | Data Type |
|---|---|---|---|
| Temperature | `temperature` | observation | float32 |
| Salinity | `salinity` | observation | float32 |
| Pressure | `pressure` | observation | float32 |
| Latitude | `latitude` | observation | float64 |
| Longitude | `longitude` | observation | float64 |
| Time | `time` | observation | datetime64[ns] |
| Platform Number | `platform_number` | observation | Unicode string |
| Cycle Number | `cycle_number` | observation | int64 |
| Pressure QC | `PRES_QC` | observation | Unicode string (1 char) |
| Temperature QC | `TEMP_QC` | observation | Unicode string (3 chars) |
| Salinity QC | `PSAL_QC` | observation | Unicode string (3 chars) |
| Source File | `source_file` | observation | Unicode string |

### 4.3 GLORYS-Argo Collocation

| Variable | NetCDF Name | Dimensions | Data Type |
|---|---|---|---|
| Argo Temperature | `argo_temperature` | observation | float64 |
| Model Temperature | `model_temperature` | observation | float64 |
| Temperature Error | `temperature_error` | observation | float64 |
| Argo Salinity | `argo_salinity` | observation | float64 |
| Model Salinity | `model_salinity` | observation | float64 |
| Salinity Error | `salinity_error` | observation | float64 |
| Pressure | `pressure` | observation | float64 |
| Latitude | `latitude` | observation | float64 |
| Longitude | `longitude` | observation | float64 |
| Time | `time` | observation | datetime64[ns] |
| Platform Number | `platform_number` | observation | Unicode string |
| Cycle Number | `cycle_number` | observation | Unicode string |

---

## 5. UNITS

| Dataset | Variable | Unit | Source |
|---|---|---|---|
| HYCOM | TEMP | **Not specified in NetCDF attrs** | HYCOM_metadata.txt notes: "PENDING OFFICIAL PRODUCT-DOCUMENTATION VERIFICATION". Standard HYCOM practice: °C |
| HYCOM | SALN | **Not specified in NetCDF attrs** | Standard HYCOM practice: PSU (practical salinity units) |
| HYCOM | UVEL | m/s | Verified in NetCDF attrs |
| HYCOM | VVEL | m/s | Verified in NetCDF attrs |
| Argo | temperature | °C | Standard Argo convention |
| Argo | salinity | PSU | Standard Argo convention |
| Argo | pressure | dbar | Standard Argo convention |
| Collocation | all *_temperature | °C | Inherited from GLORYS + Argo |
| Collocation | all *_salinity | PSU | Inherited from GLORYS + Argo |
| Collocation | *_error | °C or PSU | model - observation |

**IMPORTANT:** TEMP and SALN units are not explicitly declared in the HYCOM NetCDF file. The project metadata states these are "PENDING OFFICIAL PRODUCT-DOCUMENTATION VERIFICATION." For the API, we should:
- Report them as "°C" and "PSU" based on HYCOM standard practice
- Include a metadata note that units are inferred, not declared
- This is scientifically standard but technically unverified from the file alone

---

## 6. SPATIAL COVERAGE

### 6.1 HYCOM

| Parameter | Value |
|---|---|
| Latitude range | 5.063°N to 21.943°N |
| Longitude range | 78.02°E to 99.86°E |
| Latitude spacing | ~0.239° (uniform after stride-4 subsetting) |
| Longitude spacing | ~0.240° (uniform after stride-4 subsetting) |
| Grid type | Regular lat-lon |
| Spatial resolution | ~0.24° × ~0.24° (~27 km) |

### 6.2 Argo DM

| Parameter | Value |
|---|---|
| Latitude range | 7.80°N to 15.52°N |
| Longitude range | 83.47°E to 90.26°E |
| Grid type | **Unstructured** — individual profile locations |

### 6.3 GLORYS-Argo Collocation

| Parameter | Value |
|---|---|
| Latitude range | 7.80°N to 15.52°N |
| Longitude range | 83.47°E to 90.26°E |
| Grid type | **Unstructured** — matched observation points |

**Key observation:** The Argo/collocation data covers a much smaller sub-region (roughly 8-15.5°N, 83.5-90.3°E) within the HYCOM domain (5-22°N, 78-100°E). The Argo data is a subset of the full Bay of Bengal.

---

## 7. TEMPORAL COVERAGE

### 7.1 HYCOM

| Parameter | Value |
|---|---|
| Start | 2026-08-26 06:00 UTC |
| End | 2026-09-01 00:00 UTC |
| Time step | 6 hours |
| Total steps | 24 |
| Calendar | standard |
| Time units | datetime64[ns] (xarray representation) |

Available dates: 2026-08-26 through 2026-09-01

### 7.2 Argo DM

| Parameter | Value |
|---|---|
| Start | 2024-01-01 |
| End | 2024-01-14 |
| Unique dates | 9 (2024-01-01, 04, 06, 07, 08, 09, 10, 11, 14) |
| Total observations | 4123 (of which 1601 have valid temp+salinity) |

### 7.3 GLORYS-Argo Collocation

| Parameter | Value |
|---|---|
| Start | 2024-01-01 |
| End | 2024-01-14 |
| Unique dates | 9 (same as Argo) |
| Total matched observations | 1220 |

### 7.4 CRITICAL TEMPORAL MISMATCH

**The HYCOM model data (August-September 2026) and the Argo/collocation data (January 2024) cover completely different time periods.**

This means:
- Direct HYCOM-vs-Argo comparison for the same date is **impossible** with current data
- The GLORYS-Argo collocation represents GLORYS (a different model) matched to Argo in January 2024
- For the operational mode, HYCOM would need to be compared against near-real-time Argo NRT (not currently available)

---

## 8. DEPTH COVERAGE

### 8.1 HYCOM

| Parameter | Value |
|---|---|
| Depth levels | 6 |
| Depth values | 0, 17.5, 52.5, 125, 275, 500 m |
| Spacing | Uneven: 17.5, 35, 72.5, 150, 225 m gaps |
| Positive direction | Down |

### 8.2 Argo DM

| Parameter | Value |
|---|---|
| Pressure range | 0.0 to 500.0 dbar |
| Levels | Unstructured — 4123 individual observation depths |
| Depth assumption | 1 dbar ≈ 1 m (standard Argo approximation) |

### 8.3 GLORYS-Argo Collocation

| Parameter | Value |
|---|---|
| Pressure range | 0.5 to 445.1 dbar |
| Unique pressure levels | 702 (individual observation depths) |

---

## 9. MISSING-DATA CONVENTIONS

### 9.1 HYCOM

| Variable | Total Cells | NaN Count | NaN % | Fill Value |
|---|---|---|---|---|
| TEMP | 980,352 | 376,896 | 38.44% | -1e+34 (→ NaN by xarray) |
| SALN | 980,352 | 376,896 | 38.44% | -1e+34 (→ NaN by xarray) |
| UVEL | 980,352 | 304,848 | 31.10% | 1.2676506e+30 (→ NaN by xarray) |
| VVEL | 980,352 | 304,848 | 31.10% | 1.2676506e+30 (→ NaN by xarray) |

**The NaN cells represent land points** within the Bay of Bengal domain (coastal areas, Andaman Islands, Sri Lanka, etc.). xarray automatically masks fill values to NaN on load.

Valid ranges:
- TEMP: 8.55 to 32.78
- SALN: 2.35 to 35.55
- UVEL: -1.07 to 2.15 m/s
- VVEL: -1.50 to 1.57 m/s

### 9.2 Argo DM

| Variable | NaN Count | Total | Notes |
|---|---|---|---|
| temperature | 2522 | 4123 | 61.2% NaN — many observations lack valid temperature |
| salinity | 2522 | 4123 | Same 61.2% NaN |
| pressure | 0 | 4123 | No missing pressure values |
| TEMP_QC | 2522 NaN, 1596 "1", 4 "3", 1 "4" | 4123 | QC "1" = good |
| PSAL_QC | 2522 NaN, 1296 "1", 47 "3", 258 "4" | 4123 | QC "4" = bad |
| PRES_QC | 4122 "1", 1 "4" | 4123 | Nearly all good |

**Argo convention:** QC flag "1" = good, "2" = probably good, "3" = questionable, "4" = bad, "9" = missing.

### 9.3 GLORYS-Argo Collocation

| Variable | NaN Count | Total |
|---|---|---|
| All numeric variables | 0 | 1220 |

No missing values — the collocation process already filtered to valid matches.

### 9.4 API Missing-Data Policy

The API must:
- Never return 0, -999, or fake values for missing data
- Use `null` in JSON for unavailable values
- Return structured error responses for:
  - `INVALID_COORDINATE` — lat/lon outside any dataset coverage
  - `OUTSIDE_COVERAGE` — coordinate within domain but no data at that grid point (land)
  - `NO_MODEL_DATA` — model variable unavailable at requested point
  - `NO_OBSERVATION_DATA` — no observation at requested point
  - `NO_DATA_AVAILABLE` — neither model nor observation available
  - `UNSUPPORTED_VARIABLE` — variable not in dataset
  - `UNSUPPORTED_DEPTH` — depth beyond dataset range
  - `INVALID_DATE` — date outside dataset temporal coverage
  - `INVALID_PARAMETER` — malformed request

---

## 10. MODEL/OBSERVATION CLASSIFICATION

| Dataset | Classification | Source Model/Observation |
|---|---|---|
| `RSMC_hycom_20260827.nc` | **MODEL** (Operational Forecast) | INCOIS HYCOM 2.35 |
| `argo_dm_BOB_2024.nc` | **OBSERVATION** (In-situ) | Argo Delayed Mode (GDAC) |
| `argo_dm_BOB_index.csv` | **METADATA** (Index) | Argo GDAC profile index |
| `processed/glorys_argo_collocation_2024.nc` | **PRE-COMPUTED MATCH** | GLORYS12V1 (model) × Argo DM (obs) |

**Important distinction:**
- HYCOM = operational forecast model (future dates, Aug-Sep 2026)
- GLORYS = reanalysis model (past dates, Jan 2024) — used for the pre-computed collocation
- The collocation file contains GLORYS model values, NOT HYCOM values

---

## 11. COORDINATE QUERY STRATEGY

### 11.1 HYCOM Grid Queries

The HYCOM data is on a **regular lat-lon grid** with ~0.24° spacing.

**Strategy for arbitrary coordinate queries:**

1. **Nearest-neighbour** (recommended for initial implementation):
   - Find the closest LAT index: `idx_lat = argmin(|LAT - requested_lat|)`
   - Find the closest LON index: `idx_lon = argmin(|LON - requested_lon|)`
   - Extract the column at `(TIME, DEPTH, idx_lat, idx_lon)`
   - Use `xarray` `.sel(method='nearest')` for this

2. **Bounding-box extraction** (for spatial/map queries):
   - Select all grid points within a lat/lon bounding box
   - Use `xarray` `.sel(LAT=slice(south, north), LON=slice(west, east))`

3. **Validity check:**
   - After nearest-neighbour selection, check if the value is NaN (land point)
   - If NaN, return `OUTSIDE_COVERAGE` error

**Scientific justification for nearest-neighbour:**
- The HYCOM grid spacing is ~27 km, which is coarser than typical model accuracy
- Linear interpolation would add computational cost with marginal benefit at this resolution
- The model itself has already interpolated from its native grid to this ~0.24° grid
- For future refinement, bilinear interpolation can be added

### 11.2 Argo Observation Queries

Argo data is **unstructured** (individual profile locations).

**Strategy:**
1. Filter by bounding box: `latitude >= south & latitude <= north & longitude >= west & longitude <= east`
2. Filter by date if requested
3. Return matching observation points
4. For "nearest observation" lookups, compute haversine or Euclidean distance

### 11.3 Collocation Data Queries

Same as Argo — unstructured points. Filter by spatial/temporal bounding boxes.

---

## 12. MODEL-OBSERVATION MATCHING

### 12.1 How the Existing Collocation Was Done

From `code/collocation.py`:
- For each Argo observation at (lat, lon, time, pressure):
  - **Spatial:** Interpolated GLORYS to exact Argo lat/lon using `glorys.interp(latitude=obs_lat, longitude=obs_lon, method='linear')`
  - **Temporal:** Interpolated GLORYS to exact Argo time using same `.interp()`
  - **Depth:** Interpolated GLORYS to exact Argo pressure using same `.interp()`
  - **Method:** Trilinear interpolation in (time, lat, lon, depth)
  - **Convention:** `temperature_error = model_temperature - argo_temperature`

### 12.2 Matching Strategy for HYCOM

For the operational mode (HYCOM vs Argo NRT):

**Spatial matching:**
- Nearest HYCOM grid point to each Argo profile location
- Or bilinear interpolation from surrounding 4 HYCOM grid points

**Temporal matching:**
- HYCOM provides 6-hourly data
- Match to the closest HYCOM time step within ±3 hours
- Or interpolate between adjacent HYCOM time steps

**Depth matching:**
- HYCOM has 6 discrete depth levels: 0, 17.5, 52.5, 125, 275, 500 m
- Argo observations are at irregular depths
- For comparison at Argo depth: interpolate HYCOM vertically between its discrete levels
- For comparison at HYCOM depth: find nearest Argo observation level

**Variable matching:**
| INTEG1 Variable | HYCOM Variable | Argo Variable | Units |
|---|---|---|---|
| `temperature` | `TEMP` | `temperature` | °C (both) |
| `salinity` | `SALN` | `salinity` | PSU (both) |
| `currents_u` | `UVEL` | — (no Argo current obs) | m/s |
| `currents_v` | `VVEL` | — (no Argo current obs) | m/s |

**Currents:** Argo does not measure ocean currents directly. Model-only data available.

**Units conversion:** None required — both datasets use °C for temperature, PSU for salinity, m/s for currents. Standard Argo pressure-to-depth approximation (1 dbar ≈ 1 m) is acceptable for this prototype.

**Difference convention:** `difference = model - observation`

**Missing data handling:**
- If model has NaN at matched point → return `NO_MODEL_DATA`
- If observation has NaN → return `NO_OBSERVATION_DATA`
- If both unavailable → return `NO_DATA_AVAILABLE`

---

## 13. EXACT INTEG1 OPERATIONS DISCOVERED

From reading `frontend/src/integration/provider.ts`, `types.ts`, and all adapter/hook files:

### 13.1 Provider Interface (`OceanDataProvider`)

```
fetchComparison(request: ComparisonRequest) → ProviderResponse<ModelComparisonResult>
fetchVerticalProfile(request: ProfileRequest) → ProviderResponse<VerticalProfileResult>
fetchDiscrepancy(request: DiscrepancyRequest) → ProviderResponse<DiscrepancyResult>
fetchObservations(request: ObservationRequest) → ProviderResponse<ObservationResult>
fetchDiagnostics(request: DiagnosticRequest) → ProviderResponse<DiagnosticResult>
fetchWorkflow(diagnosticId: string) → ProviderResponse<WorkflowResult>
fetchVisualization(request: VisualizationRequest) → ProviderResponse<Visualization3DResult>
```

### 13.2 Request Types (from `types.ts`)

```typescript
ComparisonRequest {
  location: { latitude, longitude, depth? }
  variable: 'temperature' | 'salinity' | 'currents_u' | 'currents_v'
  depth: number
  date: string        // YYYY-MM-DD
  time: string        // HH:mm
}

ProfileRequest {
  location: { latitude, longitude }
  variable: OceanVariable
  date: string
  time: string
}

DiscrepancyRequest {
  region: string
  bounds: { north, south, east, west }
  variable: OceanVariable
  date: string
  time: string
}

ObservationRequest {
  region: string
  bounds?: { north, south, east, west }
  date: string
}

DiagnosticRequest {
  location: { latitude, longitude, depth? }
  variable: OceanVariable
  depth: number
  date: string
  time: string
}

VisualizationRequest {
  location: { latitude, longitude }
  variable: OceanVariable
  date: string
  time: string
}
```

### 13.3 Response Types (from `types.ts`)

**ModelComparisonResult:**
```typescript
{
  point: {
    modelValue: number
    observationValue: number
    difference: number
    unit: string
    variable: OceanVariable
    depth: number
    confidence: 'low' | 'medium' | 'high'
    timestamp: string
  }
  healthScore: number        // 0-100
  healthStatus: 'excellent' | 'good' | 'fair' | 'poor'
  healthSummary: string
  sourceModel: string
  sourceObservation: string
}
```

**VerticalProfileResult:**
```typescript
{
  points: Array<{
    depth: number
    modelValue: number
    observationValue: number
    altModelValue?: number
    unit: string
  }>
  variable: OceanVariable
  unit: string
  maxDepth: number
}
```

**DiscrepancyResult:**
```typescript
{
  points: Array<{
    latitude: number
    longitude: number
    depth: number
    errorMagnitude: number
    variable: OceanVariable
  }>
  stats: {
    meanError: number
    maxError: number
    rmsError: number
    totalPoints: number
  }
}
```

**ObservationResult:**
```typescript
{
  stations: Array<{
    id: string
    latitude: number
    longitude: number
    timestamp: string
    depth: number
    status: 'active' | 'inactive' | 'pending'
    type: 'argo' | 'glider' | 'mooring' | 'ship'
    temperature?: number
    salinity?: number
    distanceKm?: number
  }>
  totalActive: number
  totalPending: number
  region: string
}
```

**DiagnosticResult:**
```typescript
{
  id: string
  errorFingerprint: string
  possibleCauses: Array<{
    name: string
    confidence: 'low' | 'medium' | 'high'
    evidence: string[]
  }>
  topCause: { name, confidence, evidence }
  status: 'inactive' | 'active' | 'complete' | 'loading'
}
```

**WorkflowResult:**
```typescript
{
  steps: Array<{
    id: string
    title: string
    description: string
    status: DiagnosticStepStatus
  }>
  solution: {
    id: string
    recommendedTest: string
    expectedOutcome: string
    caution: string
    status: DiagnosticStepStatus
  } | null
}
```

**Visualization3DResult:**
```typescript
{
  variable: OceanVariable
  unit: string
  surfaceLayer: Array<{
    latitude: number
    longitude: number
    value: number
    unit: string
  }>
  depthSlices: Array<{
    depth: number
    meanValue: number
    unit: string
    gridPoints: SurfaceGridPoint[]
  }>
  verticalProfile: Array<{
    depth: number
    modelValue: number
    observationValue: number
  }>
}
```

### 13.4 Provider Response Wrapper

```typescript
ProviderResponse<T> {
  status: 'idle' | 'loading' | 'success' | 'error' | 'empty'
  data: T | null
  error?: string
  metadata?: {
    timestamp: string
    source: 'mock' | 'api' | 'cache'
    requestId?: string
  }
}
```

### 13.5 Adapter Transformations

The adapters in `frontend/src/integration/adapters/` transform ProviderResponse into display shapes. The backend must return the **ProviderResponse** shapes, not the display shapes. The adapters handle:

- `comparisonAdapter.ts`: `ModelComparisonResult` → `ComparisonDisplayData` + `HealthDisplayData`
- `comparisonAdapter.ts`: `VerticalProfileResult` → `ProfileDisplayPoint[]`
- `discrepancyAdapter.ts`: `DiscrepancyResult` → `DiscrepancyDisplayPoint[]` + stats
- `observationAdapter.ts`: `ObservationResult` → `ObservationDisplayPoint[]` + nearest lookup
- `diagnosticsAdapter.ts`: `DiagnosticResult` → `DiagnosticDisplayData` + workflow + solution
- `visualizationAdapter.ts`: `Visualization3DResult` → `SurfaceGridCell[]` + `DepthSliceDisplay[]` + `ProfileChartPoint[]`

---

## 14. PROPOSED API ENDPOINTS

### 14.1 Base URL

```
http://localhost:8000/api/v1
```

(The frontend already uses `VITE_API_BASE_URL || 'http://localhost:8000'` from `apiClient.ts`)

### 14.2 Endpoint Map (INTEG1 Operation → Backend Endpoint)

| INTEG1 Operation | Method | Path | Description |
|---|---|---|---|
| Health check | GET | `/health` | API status and dataset availability |
| fetchComparison | POST | `/comparison` | Model vs observation at a point |
| fetchVerticalProfile | POST | `/profile` | Vertical profile at a point |
| fetchDiscrepancy | POST | `/discrepancy` | Error map for a region |
| fetchObservations | POST | `/observations` | Observation stations in a region |
| fetchDiagnostics | POST | `/diagnostics` | Diagnostic analysis at a point |
| fetchWorkflow | GET | `/diagnostics/{id}/workflow` | Investigation workflow for a diagnostic |
| fetchVisualization | POST | `/visualization/3d` | 3D visualization data |
| Dataset info | GET | `/datasets` | Available datasets and metadata |

### 14.3 Detailed Endpoint Specifications

---

#### GET `/api/v1/health`

**Purpose:** API health check and dataset status.

**Parameters:** None

**Response:**
```json
{
  "status": "success",
  "data": {
    "api": "healthy",
    "datasets": {
      "hycom": {
        "available": true,
        "type": "model",
        "temporalCoverage": {
          "start": "2026-08-26T06:00:00Z",
          "end": "2026-09-01T00:00:00Z"
        },
        "spatialCoverage": {
          "north": 21.943,
          "south": 5.063,
          "east": 99.86,
          "west": 78.02
        }
      },
      "argo": {
        "available": true,
        "type": "observation",
        "temporalCoverage": {
          "start": "2024-01-01",
          "end": "2024-01-14"
        }
      },
      "collocation": {
        "available": true,
        "type": "precomputed_match",
        "model": "GLORYS12V1",
        "observation": "Argo DM",
        "temporalCoverage": {
          "start": "2024-01-01",
          "end": "2024-01-14"
        }
      }
    },
    "timestamp": "2026-08-30T12:00:00Z"
  }
}
```

---

#### POST `/api/v1/comparison`

**Purpose:** Model vs observation comparison at a specific coordinate, depth, and time.

**Request Body:**
```json
{
  "location": {
    "latitude": 12.5,
    "longitude": 87.3,
    "depth": 100
  },
  "variable": "temperature",
  "depth": 100,
  "date": "2024-01-10",
  "time": "12:00"
}
```

**Response (success):**
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
      "timestamp": "2026-08-30T12:00:00Z"
    },
    "healthScore": 85,
    "healthStatus": "good",
    "healthSummary": "Model temperature at 100m depth shows +0.32°C bias. Within acceptable range for this region.",
    "sourceModel": "GLORYS12V1",
    "sourceObservation": "Argo Delayed Mode"
  },
  "metadata": {
    "timestamp": "2026-08-30T12:00:00Z",
    "source": "api",
    "requestId": "req_abc123"
  }
}
```

**Response (error — outside coverage):**
```json
{
  "status": "error",
  "error": {
    "code": "OUTSIDE_COVERAGE",
    "message": "No data available at latitude 3.0, longitude 75.0 — outside dataset spatial coverage."
  }
}
```

---

#### POST `/api/v1/profile`

**Purpose:** Vertical profile of model and observation values at a coordinate.

**Request Body:**
```json
{
  "location": {
    "latitude": 12.5,
    "longitude": 87.3
  },
  "variable": "temperature",
  "date": "2024-01-10",
  "time": "12:00"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "points": [
      { "depth": 0.5, "modelValue": 27.12, "observationValue": 26.98, "unit": "°C" },
      { "depth": 10.0, "modelValue": 26.85, "observationValue": 26.71, "unit": "°C" },
      { "depth": 50.0, "modelValue": 24.30, "observationValue": 23.85, "unit": "°C" },
      { "depth": 100.0, "modelValue": 22.15, "observationValue": 21.83, "unit": "°C" },
      { "depth": 200.0, "modelValue": 16.42, "observationValue": 15.90, "unit": "°C" },
      { "depth": 445.0, "modelValue": 10.08, "observationValue": 10.02, "unit": "°C" }
    ],
    "variable": "temperature",
    "unit": "°C",
    "maxDepth": 500
  },
  "metadata": {
    "timestamp": "2026-08-30T12:00:00Z",
    "source": "api"
  }
}
```

**Note:** Profile points are derived from the collocation dataset (observation depths) plus HYCOM grid levels. The `maxDepth` is 500m (maximum depth in both datasets).

---

#### POST `/api/v1/discrepancy`

**Purpose:** Model-observation error magnitude map for a region.

**Request Body:**
```json
{
  "region": "bay-of-bengal",
  "bounds": {
    "north": 22.0,
    "south": 5.0,
    "east": 95.0,
    "west": 80.0
  },
  "variable": "temperature",
  "date": "2024-01-10",
  "time": "12:00"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "points": [
      { "latitude": 8.5, "longitude": 85.2, "depth": 100, "errorMagnitude": 0.45, "variable": "temperature" },
      { "latitude": 12.0, "longitude": 87.5, "depth": 150, "errorMagnitude": 1.23, "variable": "temperature" }
    ],
    "stats": {
      "meanError": 0.32,
      "maxError": 2.15,
      "rmsError": 0.58,
      "totalPoints": 1220
    }
  },
  "metadata": {
    "timestamp": "2026-08-30T12:00:00Z",
    "source": "api"
  }
}
```

**Note:** Points come from the collocation dataset filtered to the requested region/date. Each point represents a model-observation match location.

---

#### POST `/api/v1/observations`

**Purpose:** List observation stations/profiles in a region.

**Request Body:**
```json
{
  "region": "bay-of-bengal",
  "bounds": {
    "north": 22.0,
    "south": 5.0,
    "east": 95.0,
    "west": 80.0
  },
  "date": "2024-01-10"
}
```

**Response:**
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
    "region": "bay-of-bengal"
  },
  "metadata": {
    "timestamp": "2026-08-30T12:00:00Z",
    "source": "api"
  }
}
```

---

#### POST `/api/v1/diagnostics`

**Purpose:** Run diagnostic analysis for a location/variable/depth.

**Request Body:**
```json
{
  "location": {
    "latitude": 12.5,
    "longitude": 87.3,
    "depth": 100
  },
  "variable": "temperature",
  "depth": 100,
  "date": "2024-01-10",
  "time": "12:00"
}
```

**Response:**
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
        "evidence": [
          "Wind stress or heat flux may be mis-specified"
        ]
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
    "status": "complete"
  },
  "metadata": {
    "timestamp": "2026-08-30T12:00:00Z",
    "source": "api"
  }
}
```

---

#### GET `/api/v1/diagnostics/{id}/workflow`

**Purpose:** Investigation workflow steps for a diagnostic.

**Path Parameters:**
- `id` (string, required): Diagnostic ID from the `/diagnostics` response

**Response:**
```json
{
  "status": "success",
  "data": {
    "steps": [
      { "id": "step-1", "title": "Detect", "description": "Temperature bias detected at depth", "status": "complete" },
      { "id": "step-2", "title": "Analyze", "description": "Pattern consistent across multiple profiles", "status": "complete" },
      { "id": "step-3", "title": "Diagnose", "description": "Possible causes identified", "status": "active" },
      { "id": "step-4", "title": "Solutions", "description": "Recommended experiments", "status": "inactive" },
      { "id": "step-5", "title": "Evaluate", "description": "Compare results", "status": "inactive" }
    ],
    "solution": {
      "id": "sol-001",
      "recommendedTest": "Alternative vertical mixing configuration",
      "expectedOutcome": "Check whether subsurface temperature error decreases",
      "caution": "This analysis does not establish causality.",
      "status": "inactive"
    }
  },
  "metadata": {
    "timestamp": "2026-08-30T12:00:00Z",
    "source": "api"
  }
}
```

---

#### POST `/api/v1/visualization/3d`

**Purpose:** Structured multidimensional data for 3D visualization.

**Request Body:**
```json
{
  "location": {
    "latitude": 12.5,
    "longitude": 87.3
  },
  "variable": "temperature",
  "date": "2024-01-10",
  "time": "12:00"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "variable": "temperature",
    "unit": "°C",
    "surfaceLayer": [
      { "latitude": 11.5, "longitude": 86.3, "value": 27.1, "unit": "°C" },
      { "latitude": 11.5, "longitude": 86.54, "value": 27.0, "unit": "°C" }
    ],
    "depthSlices": [
      {
        "depth": 0,
        "meanValue": 27.12,
        "unit": "°C",
        "gridPoints": []
      },
      {
        "depth": 50,
        "meanValue": 24.30,
        "unit": "°C",
        "gridPoints": []
      }
    ],
    "verticalProfile": [
      { "depth": 0.5, "modelValue": 27.12, "observationValue": 26.98 },
      { "depth": 50.0, "modelValue": 24.30, "observationValue": 23.85 }
    ]
  },
  "metadata": {
    "timestamp": "2026-08-30T12:00:00Z",
    "source": "api"
  }
}
```

**Note:** The surface grid covers an 8×8 grid around the selected point (based on `MockOceanDataProvider` pattern: ±4 grid points × 0.25° spacing). Depth slices are at the HYCOM depth levels. Vertical profile combines model grid values with observation-derived values.

---

#### GET `/api/v1/datasets`

**Purpose:** Metadata about all available datasets.

**Response:**
```json
{
  "status": "success",
  "data": {
    "datasets": [
      {
        "id": "hycom",
        "name": "INCOIS HYCOM 2.35",
        "type": "model",
        "variables": ["temperature", "salinity", "currents_u", "currents_v"],
        "spatialCoverage": { "north": 21.943, "south": 5.063, "east": 99.86, "west": 78.02 },
        "temporalCoverage": { "start": "2026-08-26", "end": "2026-09-01" },
        "depthRange": { "min": 0, "max": 500, "levels": [0, 17.5, 52.5, 125, 275, 500] },
        "resolution": { "lat": 0.239, "lon": 0.240, "time": "6h" }
      },
      {
        "id": "argo",
        "name": "Argo Delayed Mode BOB 2024",
        "type": "observation",
        "variables": ["temperature", "salinity"],
        "spatialCoverage": { "north": 15.52, "south": 7.80, "east": 90.26, "west": 83.47 },
        "temporalCoverage": { "start": "2024-01-01", "end": "2024-01-14" },
        "depthRange": { "min": 0, "max": 500 },
        "totalProfiles": 27,
        "totalObservations": 4123
      },
      {
        "id": "collocation",
        "name": "GLORYS-Argo Collocation 2024",
        "type": "precomputed_match",
        "model": "GLORYS12V1",
        "observation": "Argo DM",
        "variables": ["temperature", "salinity"],
        "totalMatches": 1220
      }
    ]
  }
}
```

---

## 15. PROPOSED REQUEST SCHEMAS

All requests use `Content-Type: application/json`.

### Common Types

```typescript
// Coordinate types (matching INTEG1)
interface Coordinates {
  latitude: number;   // -90 to 90
  longitude: number;  // -180 to 180
  depth?: number;     // meters, 0-500
}

interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

type OceanVariable = 'temperature' | 'salinity' | 'currents_u' | 'currents_v';
```

### Request Schemas Summary

| Endpoint | Required Fields | Optional Fields |
|---|---|---|
| POST /comparison | location.lat, location.lng, variable, depth, date, time | — |
| POST /profile | location.lat, location.lng, variable, date, time | — |
| POST /discrepancy | region, bounds, variable, date, time | — |
| POST /observations | region, date | bounds |
| POST /diagnostics | location.lat, location.lng, variable, depth, date, time | — |
| POST /visualization/3d | location.lat, location.lng, variable, date, time | — |

### Date/Time Conventions

- `date`: ISO 8601 date string `YYYY-MM-DD`
- `time`: 24-hour time string `HH:mm`
- Backend parses these and matches to nearest dataset timestep

---

## 16. PROPOSED RESPONSE SCHEMAS

### Success Response

```json
{
  "status": "success",
  "data": { /* endpoint-specific payload */ },
  "metadata": {
    "timestamp": "ISO-8601",
    "source": "api",
    "requestId": "optional-uuid"
  }
}
```

### Error Response

```json
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `INVALID_COORDINATE` | 400 | Lat/lng values out of range |
| `OUTSIDE_COVERAGE` | 404 | Coordinate outside all dataset coverage |
| `NO_MODEL_DATA` | 404 | Model data unavailable at requested point |
| `NO_OBSERVATION_DATA` | 404 | No observation data at requested point |
| `NO_DATA_AVAILABLE` | 404 | Neither model nor observation available |
| `UNSUPPORTED_VARIABLE` | 400 | Variable not in any dataset |
| `UNSUPPORTED_DEPTH` | 400 | Depth beyond dataset range |
| `INVALID_DATE` | 400 | Date outside temporal coverage |
| `INVALID_PARAMETER` | 400 | Malformed request body |
| `DATASET_UNAVAILABLE` | 503 | Dataset file not found or corrupted |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## 17. MISMATCHES BETWEEN DATASETS AND INTEG1

### CRITICAL MISMATCHES

| # | Mismatch | Impact | Resolution |
|---|---|---|---|
| 1 | **HYCOM is Aug-Sep 2026; Argo is Jan 2024** — different time periods | Cannot do direct HYCOM-vs-Argo comparison for the same date | For prototype: use the GLORYS-Argo collocation for comparison endpoints. HYCOM serves as model data for spatial/visual queries only. Document that operational mode requires Argo NRT data. |
| 2 | **HYCOM has 6 depth levels; Argo has 702 unique pressure levels** | Vertical profile resolution is asymmetric | Model profile uses only 6 HYCOM levels. Observation profile uses Argo's native levels. Comparison is only possible at matched depths. |
| 3 | **Currents (UVEL/VVEL) have no Argo observation counterpart** | `currents_u` and `currents_v` cannot have model-vs-observation comparison | For currents: return model-only data. Set `observationValue` to `null`. Set `confidence` to `'low'` or add a `dataAvailability` field. The INTEG1 type doesn't explicitly prevent this but the comparison shape assumes both values exist. |
| 4 | **Aranobservation data covers smaller sub-region** (8-15.5°N, 83.5-90.3°E) than HYCOM (5-22°N, 78-100°E) | Discrepancy/observation endpoints will return empty for outer regions | Valid — return empty results with appropriate message, not an error. |
| 5 | **HYCOM platform_number strings have byte-prefix encoding** (`b'1902594 '`) | Platform IDs look ugly in API responses | Clean platform strings: strip `b'` prefix and trailing whitespace. |

### MINOR MISMATCHES

| # | Mismatch | Impact | Resolution |
|---|---|---|---|
| 6 | INTEG1 uses `OceanVariable = 'temperature' \| 'salinity' \| 'currents_u' \| 'currents_v'` | Maps cleanly to HYCOM variables | No issue. Map: temperature→TEMP, salinity→SALN, currents_u→UVEL, currents_v→VVEL |
| 7 | INTEG1 `ObservationType` includes `'glider' \| 'mooring' \| 'ship'` | Argo dataset only contains Argo floats | Return only `'argo'` type. Other observation types return empty for now. |
| 8 | INTEG1 `DiagnosticResult` expects `errorFingerprint` as a string | Our diagnostic engine produces fingerprints like `'SUBSURFACE_WARM_BIAS_50_200DBAR'` | Compatible — generate fingerprint strings from analysis patterns. |
| 9 | INTEG1 `Visualization3DResult.depthSlices[].gridPoints` expects grid data per depth | Computationally expensive to compute full grids at every depth | For prototype: return grid points only at surface layer; depth slices return only `meanValue`. The adapter (`adaptDepthSlices`) only uses `depth`, `meanValue`, and `unit` — the `gridPoints` array in the adapter output is percentage-normalized, not the raw grid. |
| 10 | INTEG1 `ProviderResponse.source` uses `'mock' \| 'api' \| 'cache'` | Backend will use `'api'` | Compatible. |

---

## 18. SCIENTIFIC LIMITATIONS

### 18.1 Data Limitations

1. **Temporal mismatch:** HYCOM forecast (2026) and Argo observations (2024) cannot be directly compared for the same date. The GLORYS-Argo collocation (Jan 2024) provides the only pre-matched model-observation data.

2. **GLORYS is a different model from HYCOM:** The collocation uses GLORYS12V1, not HYCOM. GLORYS is a global reanalysis at 1/12° resolution (~8 km). HYCOM is an operational forecast at ~0.24° resolution (~27 km). Results from the collocation cannot be directly attributed to HYCOM's behavior.

3. **Limited depth resolution in HYCOM:** Only 6 depth levels (0, 17.5, 52.5, 125, 275, 500 m) means the thermocline structure is poorly resolved compared to Argo's ~m-scale vertical resolution.

4. **Limited temporal coverage:** Argo data spans only 9 days in January 2024. This is insufficient for robust seasonal or interannual analysis.

5. **Land mask NaNs:** ~38% of HYCOM grid cells are NaN (land). The API must handle this gracefully.

6. **Argo QC filtering:** Only 1601 of 4123 observations have valid temperature AND salinity (38.8% have valid data). QC flag "4" (bad) salinity exists in 258 observations.

### 18.2 Diagnostic Limitations

The existing diagnostic pipeline (`code/diagnostic_engine.py`, `code/hypothesis_engine.py`, etc.) produces:
- Depth-dependent error patterns
- Spatial hotspot detection
- Temporal variation analysis
- Outlier detection
- N² (buoyancy frequency) correlation analysis
- Bootstrap uncertainty estimates

**What it does NOT produce:**
- Confirmed physical causation
- Causal mechanism identification
- Predictive capability
- Automated solution recommendations (only investigation pathways)

The diagnostics API must:
- Clearly label all outputs as "candidate" or "plausible" explanations
- Include scientific caution notes in responses
- Never claim to establish causation

### 18.3 Units Limitation

TEMP and SALN in the HYCOM file lack explicit unit attributes. The API should:
- Use "°C" and "PSU" based on standard HYCOM convention
- Include a note in dataset metadata that units are inferred, not file-declared
- This is scientifically standard practice but technically unverified from the file alone

---

## 19. RECOMMENDED IMPLEMENTATION ORDER

Based on dataset availability, INTEG1 contract requirements, and dependency ordering:

### Phase 2: Core Dataset Access Layer
- Set up Python backend framework (FastAPI)
- Implement lazy NetCDF loading with xarray
- Create coordinate validation and nearest-neighbour lookup utilities
- Implement HYCOM grid index caching

### Phase 3: Core Query Endpoints
- GET `/health` — dataset status
- GET `/datasets` — dataset metadata
- POST `/comparison` — single-point model vs observation (using collocation data)
- POST `/profile` — vertical profile at a point

### Phase 4: Model/Observation Retrieval
- POST `/observations` — observation station listing
- Model-only data retrieval for HYCOM (spatial subset, time slice)

### Phase 5: Model-vs-Observation Comparison
- Refine comparison endpoint with confidence scoring
- Implement health score calculation
- Add depth-dependent error statistics

### Phase 6: Vertical Profile
- Full vertical profile with model grid levels + observation levels
- Handle asymmetric depth resolution

### Phase 7: Spatial/Map Observations
- POST `/discrepancy` — regional error map
- Spatial filtering for observation listings

### Phase 8: Discrepancy
- Region-based discrepancy computation
- Statistical summary (mean, max, RMS error)

### Phase 9: Diagnostics
- POST `/diagnostics` — diagnostic analysis
- GET `/diagnostics/{id}/workflow` — investigation workflow
- Pattern detection from collocation data

### Phase 10: 3D Visualization Data
- POST `/visualization/3d` — surface grid + depth slices + profile
- Optimize for frontend rendering needs

### Phase 11: Testing + API Documentation
- Comprehensive test suite against actual data
- OpenAPI/Swagger documentation
- Error handling validation

---

## APPENDIX A: TECHNOLOGY DECISIONS

| Decision | Choice | Rationale |
|---|---|---|
| Backend framework | **FastAPI** | Python scientific ecosystem (xarray, numpy, pandas), async support, auto OpenAPI docs |
| NetCDF access | **xarray + netCDF4** | Lazy loading, indexed access, already used in code/ |
| Coordinate matching | **Nearest-neighbour (initial)** | HYCOM grid spacing ~27 km, bilinear interpolation for refinement |
| API response format | **Matching INTEG1 ProviderResponse** | Seamless integration with Ilhan's adapters |
| Error format | **Matching INTEG1 error structure** | Consistent with existing frontend error handling |
| Port | **8000** | Matches frontend `VITE_API_BASE_URL` default |

## APPENDIX B: DATASET FILE LOCATIONS

```
project_root/
├── RSMC_hycom_20260827.nc           # HYCOM model (16 MB)
├── argo_dm_BOB_2024.nc              # Argo observations (726 KB)
├── argo_dm_BOB_index.csv            # Argo index (2 KB)
├── HYCOM_metadata.txt               # HYCOM metadata documentation
├── processed/
│   └── glorys_argo_collocation_2024.nc  # GLORYS-Argo collocation (176 KB)
├── code/                            # Existing analysis pipeline
│   ├── model_loader.py
│   ├── argo_loader.py
│   ├── collocation.py
│   ├── diagnostic_engine.py
│   ├── hypothesis_engine.py
│   ├── evidence_scoring.py
│   ├── pattern_analysis.py
│   ├── profile_analysis.py
│   ├── hypothesis_testing.py
│   ├── sensitivity_analysis.py
│   ├── statistical_validation.py
│   ├── contextual_diagnostics.py
│   └── validate_collocation.py
└── frontend/src/integration/        # INTEG1 contract (DO NOT MODIFY)
    ├── types.ts
    ├── provider.ts
    ├── registry.ts
    ├── index.ts
    ├── adapters/
    ├── hooks/
    └── providers/
```

## APPENDIX C: INTEG1 → BACKEND MAPPING SUMMARY

```
INTEG1 Operation          → Backend Endpoint         → Dataset Source
─────────────────────────────────────────────────────────────────────
fetchComparison()         → POST /comparison          → Collocation + HYCOM
fetchVerticalProfile()    → POST /profile             → Collocation + HYCOM
fetchDiscrepancy()        → POST /discrepancy         → Collocation
fetchObservations()       → POST /observations        → Argo DM
fetchDiagnostics()        → POST /diagnostics         → Collocation (analysis)
fetchWorkflow()           → GET /diagnostics/{id}/workflow  → Computed from diagnostics
fetchVisualization()      → POST /visualization/3d    → HYCOM + Collocation
(health check)            → GET /health               → All datasets
(dataset info)            → GET /datasets             → All datasets
```

---

**END OF PHASE 1 REPORT**

**Awaiting review before proceeding to Phase 2 implementation.**
