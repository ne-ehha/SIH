/**
 * Canonical Ocean Data Types
 *
 * Normalized data representations that decouple visualization from
 * source-specific formats. Future data sources (Glider, CTD, BGC,
 * etc.) should produce these types through source adapters.
 */

// ── Canonical Data Record ────────────────────────────────────────────────────

export interface OceanDataRecord {
  /** Source that produced this record */
  source: string;
  /** Source type: observation, model, reanalysis */
  sourceType: 'observation' | 'model' | 'reanalysis';
  /** Dataset identifier */
  dataset: string;
  /** Platform or station identifier */
  platform?: string;
  /** Platform type: argo, glider, ctd, mooring, ship, model-grid */
  platformType?: string;
  /** Variable measured/modeled */
  variable: string;
  /** Timestamp (ISO 8601) */
  time: string;
  /** Latitude (decimal degrees, WGS84) */
  latitude: number;
  /** Longitude (decimal degrees, WGS84) */
  longitude: number;
  /** Depth below surface (meters) */
  depth?: number;
  /** Pressure (dbar) — primary vertical coordinate for Argo */
  pressure?: number;
  /** Measured or modeled value */
  value: number;
  /** Value units */
  units: string;
  /** Quality flag value (if available) */
  qualityFlag?: string;
  /** QC convention (e.g., Argo standard) */
  qcConvention?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ── Collocated Comparison Record ──────────────────────────────────────────────

export interface CollocationRecord {
  /** Source: model */
  modelSource: string;
  /** Source: observation */
  observationSource: string;
  /** Variable being compared */
  variable: string;
  /** Observation timestamp */
  time: string;
  /** Observation latitude */
  latitude: number;
  /** Observation longitude */
  longitude: number;
  /** Pressure/depth (dbar) */
  pressure: number;
  /** Model value */
  modelValue: number;
  /** Observation value */
  observationValue: number;
  /** Difference (model − observation) */
  difference: number;
  /** Platform identifier */
  platform?: string;
  /** Cycle number */
  cycle?: string;
  /** Units */
  units: string;
}

// ── Profile Record ───────────────────────────────────────────────────────────

export interface ProfileRecord {
  /** Platform identifier */
  platform: string;
  /** Cycle number */
  cycle: string;
  /** Profile latitude */
  latitude: number;
  /** Profile longitude */
  longitude: number;
  /** Profile timestamp */
  time: string;
  /** Depth levels (sorted ascending) */
  levels: Array<{
    pressure: number;
    depth?: number;
    variable: string;
    modelValue?: number;
    observationValue?: number;
    difference?: number;
    units: string;
    qualityFlag?: string;
  }>;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

// ── Model Grid Record ────────────────────────────────────────────────────────

export interface ModelGridRecord {
  /** Model source */
  source: string;
  /** Variable */
  variable: string;
  /** Time step */
  time: string;
  /** Depth level (dbar) */
  depth: number;
  /** Grid points */
  points: Array<{
    latitude: number;
    longitude: number;
    value: number | null;
    units: string;
  }>;
  /** Grid metadata */
  gridInfo?: {
    latMin: number;
    latMax: number;
    lonMin: number;
    lonMax: number;
    latSpacing: number;
    lonSpacing: number;
  };
}

// ── Vector Record (real current observations/model fields) ──────────────────

/**
 * A real horizontal velocity vector (u = eastward, v = northward).
 * Only produced by adapters when an actual U/V dataset is connected.
 * Never fabricated from other quantities.
 */
export interface VectorRecord {
  source: string;
  sourceType: 'observation' | 'model' | 'reanalysis';
  variable: 'currents_u' | 'currents_v';
  time: string;
  latitude: number;
  longitude: number;
  depth?: number;
  pressure?: number;
  /** Eastward component (m/s) */
  u: number;
  /** Northward component (m/s) */
  v: number;
  /** Magnitude sqrt(u² + v²), computed from real components only */
  magnitude: number;
  /** Direction in degrees clockwise from north */
  directionDeg: number;
  units: string;
  qualityFlag?: string;
}

// ── Dataset availability ─────────────────────────────────────────────────────

/**
 * Standard unavailability notice for capabilities whose real dataset
 * is not connected. UI must show this rather than fake data.
 */
export const DATASET_UNAVAILABLE_NOTICE =
  'Requires a real dataset that is not currently connected. No values are shown rather than fabricating data.' as const;
