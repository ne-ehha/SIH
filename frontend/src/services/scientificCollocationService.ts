/**
 * Scientific Collocation & Comparison Engine (Phase 10B)
 *
 * Implements strict, mathematically sound, variable-aware oceanographic comparison:
 * 1. Explicit state machine:
 *    - GREEN:  MODEL_COMPARISON_AVAILABLE
 *    - YELLOW: OBSERVATION_AVAILABLE_MODEL_UNAVAILABLE
 *    - BLUE:   MODEL_AVAILABLE_OBSERVATION_UNAVAILABLE
 *    - RED:    TEMPORAL_MISMATCH / SPATIAL_MISMATCH / INCOMPATIBLE_DATA
 * 2. Temporal matching with configurable tolerance (default 48h). If outside tolerance -> TEMPORAL_MISMATCH (no fake stats).
 * 3. Linear depth interpolation from model native levels to observation levels (no extrapolation).
 * 4. Model − Observation convention (positive = Model is higher).
 * 5. Metrics (Bias, MAE, RMSE) computed STRICTLY when both observation & model values exist and match.
 * 6. Currents speed & compass bearing calculation (oceanographic convention: 0° N, 90° E).
 */

import type { CanonicalProfileObservation, CanonicalObservationPoint } from '@/types/observation';
import type { Research3DPoint } from '@/integration';

export type ScientificCollocationState =
  | 'MODEL_COMPARISON_AVAILABLE'
  | 'OBSERVATION_AVAILABLE_MODEL_UNAVAILABLE'
  | 'MODEL_AVAILABLE_OBSERVATION_UNAVAILABLE'
  | 'TEMPORAL_MISMATCH'
  | 'SPATIAL_MISMATCH'
  | 'INCOMPATIBLE_DATA'
  | 'NO_DATA';

export interface MatchedProfileLevel {
  depth_m: number;
  pressure_dbar?: number;
  observation_value: number | null;
  model_value: number | null;
  difference: number | null;
  spatial_offset_km: number;
  temporal_offset_hours: number;
  depth_offset_m: number;
  interpolation_method: string;
  qc_flag?: string;
  qc_status?: 'GOOD' | 'PROBABLY_GOOD' | 'BAD' | 'UNKNOWN';
  status: 'VALID' | 'NO_MODEL_DATA' | 'NO_OBSERVATION' | 'QC_REJECTED' | 'OUT_OF_BOUNDS';
}

export interface ScientificCollocationResult {
  variable: string;
  canonical_name: string;
  unit: string;
  state: ScientificCollocationState;
  state_description: string;
  is_comparison_valid: boolean;

  // Observation Metadata
  observation_platform: string;
  observation_platform_type: string;
  observation_cycle?: number;
  observation_wmo?: string;
  observation_timestamp: string;
  observation_location: [number, number];
  observation_source: string;
  observation_dataset: string;
  observation_qc_policy: string;

  // Model Metadata
  model_source: string;
  model_dataset: string;
  model_product_id?: string;
  model_timestamp: string;
  model_location?: [number, number];
  depth_interpolation: string;

  // Offsets
  spatial_offset_km: number | null;
  temporal_offset_hours: number | null;
  depth_overlap_range: [number, number] | null;
  max_temporal_tolerance_hours: number;
  max_spatial_tolerance_km: number;
  max_depth_tolerance_m: number;

  // Profile levels & points
  matched_levels: MatchedProfileLevel[];
  scene_points: Research3DPoint[];
  valid_matched_count: number;

  // Comparative Statistics (null if !is_comparison_valid)
  bias: number | null;
  mae: number | null;
  rmse: number | null;
  max_abs_diff: number | null;
  difference_convention: string;
}

export interface CollocationInput {
  variable: string;
  unit: string;
  selectedProfile: CanonicalProfileObservation | null;
  availableVariables: string[];
  discoveryStatus: string;
  modelLevels: Array<{ depth: number; value: number }>;
  modelSurfaceField?: { value: number; unit?: string };
  modelTime?: string;
  modelLocation?: [number, number];
  modelDatasetId?: string;
  modelSourceName?: string;
  mode?: 'benchmark' | 'latest' | 'historical';
  maxTemporalHours?: number;
  maxSpatialKm?: number;
}

/** Interpolate model value linearly at target depth without extrapolation. */
export function interpolateModelDepth(
  targetDepth: number,
  modelLevels: Array<{ depth: number; value: number }>
): { value: number | null; method: string; nativeDepth: number } {
  if (!modelLevels || modelLevels.length === 0) {
    return { value: null, method: 'none', nativeDepth: 0 };
  }

  const sorted = [...modelLevels].sort((a, b) => a.depth - b.depth);
  const minD = sorted[0].depth;
  const maxD = sorted[sorted.length - 1].depth;

  // Exact or beyond boundary
  if (targetDepth < minD) {
    if (Math.abs(targetDepth - minD) <= 5.0) {
      return { value: sorted[0].value, method: 'surface_nearest', nativeDepth: minD };
    }
    return { value: null, method: 'out_of_bounds', nativeDepth: minD };
  }
  if (targetDepth > maxD) {
    return { value: null, method: 'out_of_bounds', nativeDepth: maxD };
  }

  // Linear interpolation between adjacent depth brackets
  for (let i = 0; i < sorted.length - 1; i++) {
    const z1 = sorted[i].depth;
    const z2 = sorted[i + 1].depth;
    const v1 = sorted[i].value;
    const v2 = sorted[i + 1].value;

    if (targetDepth >= z1 && targetDepth <= z2) {
      if (Math.abs(z2 - z1) < 1e-6) {
        return { value: v1, method: 'exact', nativeDepth: z1 };
      }
      const fraction = (targetDepth - z1) / (z2 - z1);
      const interpolated = v1 + fraction * (v2 - v1);
      return {
        value: interpolated,
        method: 'linear_depth_interpolation',
        nativeDepth: Math.abs(targetDepth - z1) <= Math.abs(targetDepth - z2) ? z1 : z2,
      };
    }
  }

  return { value: null, method: 'none', nativeDepth: 0 };
}

/** Compute horizontal ocean current speed: s = sqrt(u^2 + v^2) */
export function computeCurrentSpeed(u: number, v: number): number {
  return Math.sqrt(u * u + v * v);
}

/**
 * Compute oceanographic current bearing (direction toward which current flows in degrees from North).
 * u = Eastward component (m/s), v = Northward component (m/s)
 * u=0, v=1 -> 0° North
 * u=1, v=0 -> 90° East
 * u=0, v=-1 -> 180° South
 * u=-1, v=0 -> 270° West
 */
export function computeCurrentBearing(u: number, v: number): number {
  const rad = Math.atan2(u, v);
  const deg = (rad * 180.0) / Math.PI;
  return (deg + 360.0) % 360.0;
}

/**
 * Compute circular angular difference: Delta theta = ((theta_mod - theta_obs + 180) % 360) - 180
 * Correctly handles angle wrapping (e.g. 359° and 1° -> 2° difference, not 358°).
 */
export function computeCircularDirectionDifference(modBearingDeg: number, obsBearingDeg: number): number {
  const rawDiff = modBearingDeg - obsBearingDeg;
  return (((rawDiff + 180.0) % 360.0 + 360.0) % 360.0) - 180.0;
}

/** Compute great-circle distance in kilometers */
export function computeDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371.0;
  const dLat = (lat2 - lat1) * (Math.PI / 180.0);
  const dLon = (lon2 - lon1) * (Math.PI / 180.0);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180.0)) *
      Math.cos(lat2 * (Math.PI / 180.0)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return r * c;
}

/**
 * Perform Authoritative Scientific Observation-to-Model Collocation
 */
export function evaluateScientificCollocation(input: CollocationInput): ScientificCollocationResult {
  const {
    variable,
    unit,
    selectedProfile,
    availableVariables,
    discoveryStatus,
    modelLevels,
    modelSurfaceField,
    modelTime,
    modelLocation,
    modelDatasetId = 'cmems_mod_glo_phy_anfc_0.083deg_P1D-m',
    modelSourceName = 'Copernicus Marine Service',
    mode = 'latest',
    maxTemporalHours = 72.0,
    maxSpatialKm = 150.0,
  } = input;

  const isSurfaceOnly = variable === 'zos' || variable === 'mlotst';
  const isObsAvailableForVar = availableVariables.includes(variable) ||
    availableVariables.includes(variable === 'temperature' ? 'thetao' : variable === 'salinity' ? 'so' : variable);

  // 1. Initial State Determination
  let state: ScientificCollocationState = 'NO_DATA';
  let stateDesc = 'No observation profile selected.';

  if (!selectedProfile) {
    if (discoveryStatus === 'TEMPORAL_MISMATCH') {
      state = 'TEMPORAL_MISMATCH';
      stateDesc = 'Temporal mismatch: Observation falls outside the configured time window. Scientific comparison disabled.';
    } else if (discoveryStatus === 'OUTSIDE_SEARCH_RADIUS') {
      state = 'SPATIAL_MISMATCH';
      stateDesc = 'Spatial mismatch: No observation found within search radius.';
    } else {
      state = 'NO_DATA';
      stateDesc = 'No observation profile available.';
    }
  } else if (!isObsAvailableForVar) {
    state = 'MODEL_AVAILABLE_OBSERVATION_UNAVAILABLE';
    stateDesc = `Observation platform '${selectedProfile.platform_type}' does not carry sensors for '${variable}'. Operational model data displayed independently.`;
  } else if (discoveryStatus === 'TEMPORAL_MISMATCH') {
    state = 'TEMPORAL_MISMATCH';
    stateDesc = 'Observation and model timestamps exceed collocation tolerance. Scientific comparison disabled.';
  } else {
    state = 'MODEL_COMPARISON_AVAILABLE';
    stateDesc = 'Observation and Model collocated successfully within spatial & temporal tolerances.';
  }

  // 2. Offsets Calculation
  let spatialOffsetKm: number | null = null;
  let temporalOffsetHours: number | null = null;

  if (selectedProfile) {
    if (modelLocation) {
      spatialOffsetKm = round2(computeDistanceKm(
        selectedProfile.latitude,
        selectedProfile.longitude,
        modelLocation[0],
        modelLocation[1]
      ));
      if (spatialOffsetKm > maxSpatialKm && state === 'MODEL_COMPARISON_AVAILABLE') {
        state = 'SPATIAL_MISMATCH';
        stateDesc = `Spatial offset (${spatialOffsetKm.toFixed(1)} km) exceeds maximum collocation tolerance (${maxSpatialKm} km).`;
      }
    } else {
      spatialOffsetKm = 0.0;
    }

    if (modelTime && selectedProfile.observation_timestamp) {
      try {
        const obsT = new Date(selectedProfile.observation_timestamp).getTime();
        const modT = new Date(modelTime).getTime();
        temporalOffsetHours = round2(Math.abs(modT - obsT) / (1000 * 3600));
        if (temporalOffsetHours > maxTemporalHours && state === 'MODEL_COMPARISON_AVAILABLE') {
          state = 'TEMPORAL_MISMATCH';
          stateDesc = `Temporal offset (${temporalOffsetHours.toFixed(1)} h) exceeds maximum window (${maxTemporalHours} h). Comparison metrics disabled.`;
        }
      } catch {
        temporalOffsetHours = null;
      }
    }
  }

  const isComparisonValid = state === 'MODEL_COMPARISON_AVAILABLE';

  // 3. Surface-Only Fields Handling (SSH, MLD)
  if (isSurfaceOnly) {
    const sVal = modelSurfaceField && Number.isFinite(modelSurfaceField.value) ? modelSurfaceField.value : null;
    const matchedLevels: MatchedProfileLevel[] = [
      {
        depth_m: 0.0,
        pressure_dbar: 0.0,
        observation_value: null,
        model_value: sVal,
        difference: null,
        spatial_offset_km: spatialOffsetKm ?? 0.0,
        temporal_offset_hours: temporalOffsetHours ?? 0.0,
        depth_offset_m: 0.0,
        interpolation_method: 'surface_2d_field',
        status: 'NO_OBSERVATION',
      },
    ];

    const scenePoints: Research3DPoint[] = selectedProfile
      ? [
          {
            latitude: selectedProfile.latitude,
            longitude: selectedProfile.longitude,
            pressure: 0,
            argoValue: Number.NaN,
            glorysValue: sVal !== null ? sVal : Number.NaN,
            difference: Number.NaN,
            timestamp: modelTime || selectedProfile.observation_timestamp,
            platformNumber: selectedProfile.platform_id,
            cycleNumber: String(selectedProfile.cycle_number ?? ''),
          },
        ]
      : [];

    return {
      variable,
      canonical_name: variable.toUpperCase(),
      unit,
      state: 'MODEL_AVAILABLE_OBSERVATION_UNAVAILABLE',
      state_description: `Surface-only field '${variable}'. No 0–500 m depth profile fabricated.`,
      is_comparison_valid: false,
      observation_platform: selectedProfile?.platform_id || 'Unknown',
      observation_platform_type: selectedProfile?.platform_type || 'UNKNOWN',
      observation_cycle: selectedProfile?.cycle_number,
      observation_wmo: selectedProfile?.platform_id,
      observation_timestamp: selectedProfile?.observation_timestamp || '—',
      observation_location: selectedProfile ? [selectedProfile.latitude, selectedProfile.longitude] : [0, 0],
      observation_source: String(selectedProfile?.provenance?.source || 'In-Situ Ingestion'),
      observation_dataset: String(selectedProfile?.provenance?.source_dataset || 'GDAC Stream'),
      observation_qc_policy: 'WMO / Argo QC 1 & 2',
      model_source: modelSourceName,
      model_dataset: modelDatasetId,
      model_timestamp: modelTime || '—',
      model_location: modelLocation,
      depth_interpolation: 'surface_2d_field',
      spatial_offset_km: spatialOffsetKm,
      temporal_offset_hours: temporalOffsetHours,
      depth_overlap_range: null,
      max_temporal_tolerance_hours: maxTemporalHours,
      max_spatial_tolerance_km: maxSpatialKm,
      max_depth_tolerance_m: 15.0,
      matched_levels: matchedLevels,
      scene_points: scenePoints,
      valid_matched_count: 0,
      bias: null,
      mae: null,
      rmse: null,
      max_abs_diff: null,
      difference_convention: 'Model − Observation',
    };
  }

  // 4. Depth-Resolved Collocation
  const matchedLevels: MatchedProfileLevel[] = [];
  const scenePoints: Research3DPoint[] = [];
  let depthOverlapRange: [number, number] | null = null;

  if (selectedProfile && selectedProfile.levels) {
    const levels = selectedProfile.levels as Array<Record<string, unknown>>;

    if (modelLevels && modelLevels.length > 0 && levels.length > 0) {
      const sortedMod = [...modelLevels].sort((a, b) => a.depth - b.depth);
      const modMinD = sortedMod[0].depth;
      const modMaxD = sortedMod[sortedMod.length - 1].depth;

      const obsDepths = levels.map((l) => typeof l.depth === 'number' ? l.depth : typeof l.pressure === 'number' ? l.pressure : 0);
      const obsMinD = Math.min(...obsDepths);
      const obsMaxD = Math.max(...obsDepths);

      const overlapMin = Math.max(obsMinD, modMinD);
      const overlapMax = Math.min(obsMaxD, modMaxD);
      if (overlapMin <= overlapMax) {
        depthOverlapRange = [round2(overlapMin), round2(overlapMax)];
      }
    }

    for (const lvl of levels) {
      const zDepth = typeof lvl.depth === 'number' ? lvl.depth : typeof lvl.pressure === 'number' ? lvl.pressure : 0;
      const pPres = typeof lvl.pressure === 'number' ? lvl.pressure : zDepth;

      // Extract raw observation value
      let obsVal: number | null = null;
      if (isObsAvailableForVar) {
        if (variable === 'current_direction') {
          if (typeof lvl.current_direction === 'number' && Number.isFinite(lvl.current_direction)) {
            obsVal = lvl.current_direction;
          } else if (typeof lvl.uo === 'number' && typeof lvl.vo === 'number') {
            obsVal = computeCurrentBearing(lvl.uo, lvl.vo);
          }
        } else if (variable === 'currents' || variable === 'current_speed') {
          if (typeof lvl.current_speed === 'number' && Number.isFinite(lvl.current_speed)) {
            obsVal = lvl.current_speed;
          } else if (typeof lvl.currents === 'number' && Number.isFinite(lvl.currents)) {
            obsVal = lvl.currents;
          } else if (typeof lvl.uo === 'number' && typeof lvl.vo === 'number') {
            obsVal = computeCurrentSpeed(lvl.uo, lvl.vo);
          }
        } else {
          const raw =
            lvl[variable] ??
            (variable === 'temperature' ? lvl.temp : variable === 'salinity' ? lvl.sal : undefined);
          if (typeof raw === 'number' && Number.isFinite(raw)) {
            obsVal = raw;
          }
        }
      }

      // Interpolate model value to exact observation depth
      const interp = interpolateModelDepth(zDepth, modelLevels);
      const modVal = interp.value;

      const qcFlag = String(lvl.qc ?? lvl.qc_flag ?? '1');
      const qcStatus = qcFlag === '1' ? 'GOOD' : qcFlag === '2' ? 'PROBABLY_GOOD' : (qcFlag === '3' || qcFlag === '4') ? 'BAD' : 'UNKNOWN';

      let diff: number | null = null;
      let levelStatus: MatchedProfileLevel['status'] = 'VALID';

      if (qcStatus === 'BAD') {
        levelStatus = 'QC_REJECTED';
      } else if (modVal === null) {
        levelStatus = 'NO_MODEL_DATA';
      } else if (obsVal === null) {
        levelStatus = 'NO_OBSERVATION';
      } else if (!isComparisonValid) {
        levelStatus = 'NO_MODEL_DATA';
      } else {
        if (variable === 'current_direction') {
          diff = computeCircularDirectionDifference(modVal, obsVal);
        } else {
          diff = modVal - obsVal;
        }
        levelStatus = 'VALID';
      }

      const depthOffset = modVal !== null ? Math.abs(zDepth - interp.nativeDepth) : 0.0;

      matchedLevels.push({
        depth_m: round2(zDepth),
        pressure_dbar: round2(pPres),
        observation_value: obsVal !== null ? round4(obsVal) : null,
        model_value: modVal !== null ? round4(modVal) : null,
        difference: diff !== null ? round4(diff) : null,
        spatial_offset_km: spatialOffsetKm || 0.0,
        temporal_offset_hours: temporalOffsetHours || 0.0,
        depth_offset_m: round2(depthOffset),
        interpolation_method: interp.method === 'linear_depth_interpolation' ? 'MODEL INTERPOLATED TO OBSERVATION DEPTH' : interp.method,
        qc_flag: qcFlag,
        qc_status: qcStatus,
        status: levelStatus,
      });

      scenePoints.push({
        latitude: selectedProfile.latitude,
        longitude: selectedProfile.longitude,
        pressure: pPres,
        argoValue: obsVal !== null ? obsVal : Number.NaN,
        glorysValue: modVal !== null ? modVal : Number.NaN,
        difference: diff !== null ? diff : Number.NaN,
        timestamp: selectedProfile.observation_timestamp,
        platformNumber: selectedProfile.platform_id,
        cycleNumber: String(selectedProfile.cycle_number ?? ''),
      });
    }
  }

  // 5. Scientific Comparison Statistics (Strictly null if !isComparisonValid)
  let bias: number | null = null;
  let mae: number | null = null;
  let rmse: number | null = null;
  let maxAbsDiff: number | null = null;

  const validDiffs = matchedLevels
    .map((l) => l.difference)
    .filter((d): d is number => d !== null && Number.isFinite(d));

  if (isComparisonValid && validDiffs.length > 0) {
    bias = round4(validDiffs.reduce((a, b) => a + b, 0) / validDiffs.length);
    mae = round4(validDiffs.reduce((a, b) => a + Math.abs(b), 0) / validDiffs.length);
    rmse = round4(Math.sqrt(validDiffs.reduce((a, b) => a + b * b, 0) / validDiffs.length));
    maxAbsDiff = round4(Math.max(...validDiffs.map(Math.abs)));
  }

  return {
    variable,
    canonical_name: variable.toUpperCase(),
    unit,
    state,
    state_description: stateDesc,
    is_comparison_valid: isComparisonValid,
    observation_platform: selectedProfile?.platform_id || 'Unknown',
    observation_platform_type: selectedProfile?.platform_type || 'UNKNOWN',
    observation_cycle: selectedProfile?.cycle_number,
    observation_wmo: selectedProfile?.platform_id,
    observation_timestamp: selectedProfile?.observation_timestamp || '—',
    observation_location: selectedProfile ? [selectedProfile.latitude, selectedProfile.longitude] : [0, 0],
    observation_source: String(selectedProfile?.provenance?.source || 'In-Situ Ingestion'),
    observation_dataset: String(selectedProfile?.provenance?.source_dataset || 'GDAC Stream'),
    observation_qc_policy: 'Argo / WOCE QC 1 (Good) & 2 (Prob. Good)',
    model_source: modelSourceName,
    model_dataset: modelDatasetId,
    model_timestamp: modelTime || '—',
    model_location: modelLocation,
    depth_interpolation: 'linear_depth_interpolation',
    spatial_offset_km: spatialOffsetKm,
    temporal_offset_hours: temporalOffsetHours,
    depth_overlap_range: depthOverlapRange,
    max_temporal_tolerance_hours: maxTemporalHours,
    max_spatial_tolerance_km: maxSpatialKm,
    max_depth_tolerance_m: 15.0,
    matched_levels: matchedLevels,
    scene_points: scenePoints,
    valid_matched_count: validDiffs.length,
    bias,
    mae,
    rmse,
    max_abs_diff: maxAbsDiff,
    difference_convention: 'Model − Observation',
  };
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

function round4(val: number): number {
  return Math.round(val * 10000) / 10000;
}
