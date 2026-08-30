# INTEG1 COMPATIBILITY: Model-Only Variables (currents_u, currents_v)

**Date:** 2026-08-30
**Status:** Analysis complete — awaiting approval

---

## 1. THE PROBLEM

The INTEG1 contract defines these types with **non-optional numeric fields**:

```typescript
// types.ts line 24-33
interface ModelObservationDataPoint {
  modelValue: number;
  observationValue: number;   // ← NOT optional, no ? suffix
  difference: number;         // ← NOT optional, no ? suffix
  unit: string;
  variable: OceanVariable;
  depth: number;
  confidence: 'low' | 'medium' | 'high';
  timestamp: string;
}

// types.ts line 41-48
interface VerticalProfilePoint {
  depth: number;
  modelValue: number;
  observationValue: number;   // ← NOT optional, no ? suffix
  altModelValue?: number;     // ← THIS one IS optional
  unit: string;
}
```

Currents (`currents_u`, `currents_v`) have **no Argo observation counterpart**. There is no observation value to return.

---

## 2. DECISION FROM REVIEW

> For model-only variables such as currents_u and currents_v, the backend API should omit observationValue and difference when no observation counterpart exists, rather than returning null.

This means: **do not include the fields in the JSON response at all**.

---

## 3. EXACT BACKEND RESPONSE STRUCTURES

### 3.1 POST `/comparison` — currents_u or currents_v

**Request:**
```json
{
  "location": { "latitude": 12.5, "longitude": 87.3, "depth": 100 },
  "variable": "currents_u",
  "depth": 100,
  "date": "2024-01-10",
  "time": "12:00"
}
```

**Backend decision:** This endpoint serves GLORYS×Argo collocation (Pipeline A). Argo has no currents data. The endpoint **rejects the request**.

**Response:**
```json
{
  "status": "error",
  "error": {
    "code": "UNSUPPORTED_VARIABLE",
    "message": "Variable 'currents_u' is not supported for model-observation comparison. Argo observations do not include ocean current measurements. Use /visualization/3d or /model/profile for model-only currents data."
  }
}
```

**Rationale:** Returning a comparison with missing observation data would crash the frontend (`DifferenceCard.tsx` calls `value.toFixed(2)` — line 31 — which throws on `undefined`). Since currents genuinely cannot be compared, the honest response is an error directing to the correct endpoint.

---

### 3.2 POST `/visualization/3d` — currents_u or currents_v

**Request:**
```json
{
  "location": { "latitude": 12.5, "longitude": 87.3 },
  "variable": "currents_u",
  "date": "2026-08-28",
  "time": "12:00"
}
```

**Response (observationValue and difference OMITTED from verticalProfile):**
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
      {
        "depth": 17.5,
        "meanValue": 0.32,
        "unit": "m/s",
        "gridPoints": []
      },
      {
        "depth": 52.5,
        "meanValue": 0.24,
        "unit": "m/s",
        "gridPoints": []
      },
      {
        "depth": 125,
        "meanValue": 0.15,
        "unit": "m/s",
        "gridPoints": []
      },
      {
        "depth": 275,
        "meanValue": 0.08,
        "unit": "m/s",
        "gridPoints": []
      },
      {
        "depth": 500,
        "meanValue": 0.03,
        "unit": "m/s",
        "gridPoints": []
      }
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
  "metadata": {
    "timestamp": "2026-08-30T12:00:00Z",
    "source": "api"
  }
}
```

**Key:** `observationValue` is **absent** from each `verticalProfile` entry. Not `null`, not `0` — the field does not exist in the JSON.

---

### 3.3 POST `/model/profile` — currents_u or currents_v

**Request:**
```json
{
  "location": { "latitude": 12.5, "longitude": 87.3 },
  "variable": "currents_u",
  "date": "2026-08-28",
  "time": "12:00"
}
```

**Response:**
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
    "observationNote": "Observation data unavailable for currents. Model-only profile."
  },
  "metadata": {
    "timestamp": "2026-08-30T12:00:00Z",
    "source": "api"
  }
}
```

**Key:** `observationValue` is **absent** from each `points` entry.

---

### 3.4 POST `/model/grid` — currents_u or currents_v

**Response:**
```json
{
  "status": "success",
  "data": {
    "variable": "currents_u",
    "unit": "m/s",
    "depth": 0,
    "sourceModel": "INCOIS HYCOM 2.35",
    "gridPoints": [
      { "latitude": 10.13, "longitude": 85.26, "value": 0.38, "unit": "m/s" },
      { "latitude": 10.13, "longitude": 85.50, "value": 0.34, "unit": "m/s" }
    ],
    "gridInfo": { "..." : "..." }
  }
}
```

**No compatibility issue here** — `SurfaceGridPoint` does not have an `observationValue` field.

---

## 4. HOW THE INTEG1 ADAPTER PROCESSES OMITTED FIELDS

### 4.1 The Data Flow

```
Backend JSON response
  ↓ (HTTP)
apiClient.ts: apiGet() / apiPost()
  → parses JSON into ApiResponse<T>
  → { status: 'success', data: { ... } }
  ↓
ApiOceanDataProvider.fetchVisualization()     ← Ayan implements this
  → wraps as ProviderResponse<Visualization3DResult>
  → { status: 'success', data: { variable, depthSlices, verticalProfile, ... } }
  ↓
useVisualization3D hook
  → calls provider.fetchVisualization()
  → passes response to adapters
  ↓
adaptProfileForChart(response)
  → return response.data.verticalProfile   ← direct passthrough
  ↓
ProfileChartPoint[] fed to Recharts <Line> component
```

### 4.2 What Happens at Each Step for Omitted Fields

**Step 1 — Backend JSON:**
```json
{ "depth": 0, "modelValue": 0.35, "unit": "m/s" }
```
The `observationValue` field is absent. The JSON is valid.

**Step 2 — `apiClient.ts` parses JSON:**
```javascript
const data = await response.json();
// data.points[0] = { depth: 0, modelValue: 0.35, unit: "m/s" }
// data.points[0].observationValue === undefined  (property doesn't exist)
```

**Step 3 — `ApiOceanDataProvider` wraps as `ProviderResponse`:**
```javascript
return {
  status: 'success',
  data: {
    verticalProfile: [
      { depth: 0, modelValue: 0.35, unit: "m/s" },
      // observationValue is absent → undefined in JS
    ]
  }
};
```

**Step 4 — `adaptProfileForChart()` (visualizationAdapter.ts line 70-73):**
```typescript
export function adaptProfileForChart(
  response: ProviderResponse<Visualization3DResult>
): ProfileChartPoint[] {
  if (response.status !== 'success' || !response.data) return [];
  return response.data.verticalProfile;
  // Returns: [{ depth: 0, modelValue: 0.35, unit: "m/s" }, ...]
  // observationValue is undefined on each object
}
```

This function is a **direct passthrough** — no field access, no transformation. It returns the raw objects. Undefined fields pass through harmlessly.

**Step 5 — Recharts `<Line>` component (VerticalProfile.tsx line92):**
```jsx
<Line
  type="monotone"
  dataKey="observationValue"
  stroke="#a855f7"
  strokeWidth={2}
  name="Observation"
  dot={false}
  strokeDasharray="5 5"
/>
```

Recharts reads `dataKey="observationValue"` from each data point. When the value is `undefined`:
- Recharts **skips rendering** that point on the line
- If ALL points have `undefined` observationValue, the entire observation line is not drawn
- **No crash, no error** — this is standard Recharts behavior for missing data

**Result:** The chart renders only the model line (cyan, solid). The observation line (purple, dashed) is simply absent. This is the correct visual behavior for model-only data.

---

## 5. CRASH POINT: `adaptComparison` + `DifferenceCard`

The comparison adapter does NOT have this safe passthrough behavior:

**`adaptComparison()` (comparisonAdapter.ts line 51-62):**
```typescript
export function adaptComparison(
  response: ProviderResponse<ModelComparisonResult>
): ComparisonDisplayData | null {
  if (response.status !== 'success' || !response.data) return null;
  const { point } = response.data;
  return {
    modelValue: point.modelValue,
    observationValue: point.observationValue,  // ← accesses the field
    difference: point.difference,                // ← accesses the field
    unit: point.unit,
    variable: point.variable,
  };
}
```

If `observationValue` is absent from `point`, `point.observationValue` evaluates to `undefined`. The adapter returns:
```javascript
{ modelValue: 0.35, observationValue: undefined, difference: undefined, ... }
```

**`DifferenceCard` (DifferenceCard.tsx line 31):**
```tsx
<p className="mt-1 text-xl font-bold">
  {sign}{value.toFixed(2)}   // ← CRASH: undefined.toFixed is not a function
</p>
```

**This would throw: `TypeError: Cannot read properties of undefined (reading 'toFixed')`**

This is why the `/comparison` endpoint **must reject currents** with `UNSUPPORTED_VARIABLE` rather than returning a partial response.

---

## 6. COMPATIBILITY SUMMARY

| Endpoint | currents_u/v | observationValue handling | INTEG1 Compatible? | Frontend Impact |
|---|---|---|---|---|
| POST `/comparison` | **Rejected** | N/A — error response | ✅ Yes (error path) | Error message shown, no crash |
| POST `/profile` | **Rejected** | N/A — error response | ✅ Yes (error path) | Error message shown, no crash |
| POST `/discrepancy` | **Rejected** | N/A — error response | ✅ Yes (error path) | Error message shown, no crash |
| POST `/visualization/3d` | **Supported** | Omitted from JSON | ✅ Yes | Recharts skips observation line |
| POST `/model/profile` | **Supported** | Omitted from JSON | ⚠️ Adapter reads undefined | See §7 |
| POST `/model/grid` | **Supported** | N/A (no obs field in SurfaceGridPoint) | ✅ Yes | No issue |

---

## 7. THE ONE REMAINING COMPATIBILITY ISSUE

### `/model/profile` → `adaptVerticalProfile` → `ProfileDisplayPoint`

The profile adapter (comparisonAdapter.ts line 86-97):
```typescript
export function adaptVerticalProfile(
  response: ProviderResponse<VerticalProfileResult>
): ProfileDisplayPoint[] {
  if (response.status !== 'success' || !response.data) return [];
  return response.data.points.map((p) => ({
    depth: p.depth,
    depthLabel: `${p.depth}m`,
    modelValue: p.modelValue,
    observationValue: p.observationValue,  // ← undefined for currents
    comparisonModelValue: p.altModelValue,
  }));
}
```

This returns:
```javascript
[
  { depth: 0, depthLabel: "0m", modelValue: 0.35, observationValue: undefined, comparisonModelValue: undefined }
]
```

The `ProfileDisplayPoint` is consumed by the **VerticalProfile recharts component** (VerticalProfile.tsx line92):
```jsx
<Line dataKey="observationValue" ... />
```

Same as the3D case — Recharts skips undefined values. **No crash.**

**But:** The `useVerticalProfile` hook uses this adapter output. The hook is called from the comparison pipeline context. For currents, the `/model/profile` endpoint would be called instead of `/profile`. The hook doesn't know which endpoint was called — it just calls `provider.fetchVerticalProfile()`.

**Resolution:** The `ApiOceanDataProvider.fetchVerticalProfile()` method (which Ayan implements) would route currents requests to the `/model/profile` endpoint instead of `/profile`. The response shape (`VerticalProfileResult`) is the same. The adapter processes it identically. The undefined observationValue passes through to Recharts harmlessly.

---

## 8. FINAL DECISION MATRIX

| Variable | Comparison Endpoint | Profile Endpoint | Visualization Endpoint | Grid Endpoint |
|---|---|---|---|---|
| `temperature` | ✅ GLORYS×Argo | ✅ GLORYS×Argo | ✅ HYCOM model-only | ✅ HYCOM model-only |
| `salinity` | ✅ GLORYS×Argo | ✅ GLORYS×Argo | ✅ HYCOM model-only | ✅ HYCOM model-only |
| `currents_u` | ❌ UNSUPPORTED_VARIABLE | ⚠️ HYCOM model-only (omitted obs) | ✅ HYCOM model-only (omitted obs) | ✅ HYCOM model-only |
| `currents_v` | ❌ UNSUPPORTED_VARIABLE | ⚠️ HYCOM model-only (omitted obs) | ✅ HYCOM model-only (omitted obs) | ✅ HYCOM model-only |

**"omitted obs"** = `observationValue` field is absent from JSON. Recharts handles `undefined` by skipping the data point on the observation line.

---

## 9. WHAT THE FRONTEND WILL DISPLAY FOR CURRENTS

### On the 3D Visualization panel:
- **Surface heatmap:** Shows model current velocity at surface. No observation overlay.
- **Depth slices bar chart:** Shows model mean current at each depth. No observation bars.
- **Vertical profile chart:** Shows only the model line (cyan, solid). The observation line (purple, dashed) is absent because Recharts skips undefined data points.
- **Metadata note:** `observationNote: "Observation data unavailable for currents. Model-only visualization."` can be displayed by the frontend if it chooses to read it.

### On the Comparison panel:
- If user selects `currents_u` or `currents_v` and clicks compare:
  - The `/comparison` endpoint returns `UNSUPPORTED_VARIABLE` error
  - The `useModelComparison` hook receives `response.status === 'error'`
  - Sets `error: "Variable 'currents_u' is not supported for model-observation comparison..."`
  - The UI shows the error message
  - No crash

---

## 10. NO FRONTEND MODIFICATIONS REQUIRED

The approach works within the existing INTEG1 contract because:

1. **Comparison endpoints reject currents** → error path, no data rendering
2. **Visualization/model endpoints omit observationValue** → Recharts handles `undefined` by skipping
3. **No adapter code is modified** — the adapters pass through what they receive
4. **No type modifications** — the TypeScript types declare `number` but JSON `undefined` (from omitted fields) is tolerated at runtime
5. **The `ApiOceanDataProvider`** (Ayan's new code) routes currents to the correct endpoints

The only frontend consideration is that `DifferenceCard.tsx` line31 (`value.toFixed(2)`) would crash on `undefined` — but this code path is never reached for currents because the comparison endpoint rejects them before data reaches the adapter.

---

**END OF INTEG1 CURRENTS COMPATIBILITY ANALYSIS**
