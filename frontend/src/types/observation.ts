import type { CanonicalDataMode, ObservationPlatformType } from './unifiedData';

export interface ObservationPoint {
  id: string;
  platform_id?: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  depth: number;
  status: 'active' | 'inactive' | 'pending';
  type: 'argo' | 'glider' | 'ctd' | 'bgc' | 'mooring' | 'ship';
  platform_type?: ObservationPlatformType;
  data_mode?: CanonicalDataMode;
  source?: string;
  temperature?: number;
  salinity?: number;
  chl?: number;
  o2?: number;
  no3?: number;
  qc_status?: string;
}

export type CanonicalQCStatus = 'GOOD' | 'PROBABLY_GOOD' | 'BAD' | 'UNKNOWN';

export interface CanonicalObservationPoint {
  observation_id: string;
  platform_type: ObservationPlatformType;
  platform_id: string;
  cycle_number?: number;
  data_mode: CanonicalDataMode;
  observation_timestamp: string;
  latitude: number;
  longitude: number;
  depth: number;
  original_depth?: number;
  pressure?: number;
  variable: string;
  canonical_variable: string;
  value?: number;
  unit: string;
  qc_flag: string;
  qc_status: CanonicalQCStatus;
  qc_accepted: boolean;
  source: string;
  source_dataset: string;
  processing_level: string;
  parameter_code: string;
  sensor_available: boolean;
  is_adjusted: boolean;
  observation_age_hours?: number;
  institution?: string;
}

export interface CanonicalProfileObservation {
  profile_id: string;
  platform_type: ObservationPlatformType;
  platform_id: string;
  cycle_number?: number;
  data_mode: CanonicalDataMode;
  observation_timestamp: string;
  latitude: number;
  longitude: number;
  available_variables: string[];
  levels: Array<Record<string, unknown>>;
  observations_by_variable: Record<string, CanonicalObservationPoint[]>;
  qc_summary: Record<string, unknown>;
  provenance: Record<string, unknown>;
  institution?: string;
}

export interface ObservationDiscoveryResponse {
  status:
    | 'OBSERVATION_AVAILABLE'
    | 'OBSERVATION_UNAVAILABLE'
    | 'AUTHENTICATION_REQUIRED'
    | 'SOURCE_UNAVAILABLE'
    | 'UPSTREAM_ERROR'
    | 'INVALID_QUERY'
    | 'INVALID_QC'
    | 'OUTSIDE_SEARCH_RADIUS'
    | 'TEMPORAL_MISMATCH';
  query: {
    latitude: number;
    longitude: number;
    target_datetime?: string;
    platform?: ObservationPlatformType;
    variable?: string;
    radius_km: number;
    max_temporal_hours: number;
    data_mode?: CanonicalDataMode;
  };
  selected_profile?: CanonicalProfileObservation;
  available_variables: string[];
  observations: CanonicalObservationPoint[];
  candidate_profiles_count: number;
  matching?: {
    spatial_offset_km: number;
    temporal_offset_hours: number;
    requested_location: [number, number];
    observation_location: [number, number];
    observation_timestamp: string;
  };
  provenance: Record<string, unknown>;
}
