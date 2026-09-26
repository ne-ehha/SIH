/**
 * Unified Ocean Data Contract TypeScript Definitions (Phase 3)
 *
 * Defines shared normalized representations for observations, model forecasts,
 * reanalysis collocations, and dataset registry metadata.
 */

export type AvailabilityStatus =
  | 'available'
  | 'registered_access_required'
  | 'upstream_unavailable'
  | 'architecture_ready';

export type DataKind = 'observed' | 'model' | 'derived' | 'unavailable';

export type SourceType = 'observation' | 'model' | 'reanalysis' | 'collocation';
export type RetrievalCapability = 'live_api' | 'local_file' | 'gdac_index' | 'auth_required' | 'not_implemented';

export type CanonicalDataMode = 'LIVE_NRT' | 'HISTORICAL_RESEARCH';
export type ObservationPlatformType = 'ARGO' | 'ARGO_CORE' | 'ARGO_BGC' | 'GLIDER' | 'CTD' | 'SHIP_CTD' | 'BGC' | 'ALL' | 'MOORING' | 'SHIP';
export type VerticalCoverageType = 'depth_resolved' | 'surface_only';

export type CompatibilityState =
  | 'MODEL_COMPARISON_AVAILABLE'
  | 'OBSERVATION_AVAILABLE_MODEL_UNAVAILABLE'
  | 'MODEL_AVAILABLE_OBSERVATION_UNAVAILABLE'
  | 'INCOMPATIBLE_DATA'
  | 'INVALID_QC'
  | 'OUTSIDE_MODEL_DOMAIN'
  | 'TEMPORAL_MISMATCH'
  | 'SPATIAL_MISMATCH'
  | 'DEPTH_MISMATCH';

export interface SpatialCoverage {
  south: number;
  north: number;
  west: number;
  east: number;
  region_name?: string;
}

export interface TemporalCoverage {
  start: string;
  end: string;
  resolution: string;
  available_dates?: string[];
}

export interface VerticalCoverage {
  min_depth: number;
  max_depth: number;
  unit: string;
  standard_levels?: number[];
}

export interface RegisteredDataset {
  dataset_id: string;
  dataset_name: string;
  product_id: string;
  product_name: string;
  source_id: string;
  source_name: string;
  source_type: SourceType;
  description: string;
  supported_variables: string[];
  variable_units: Record<string, string>;
  spatial_coverage: SpatialCoverage;
  temporal_coverage: TemporalCoverage;
  vertical_coverage: VerticalCoverage;
  availability_status: AvailabilityStatus;
  retrieval_capability: RetrievalCapability;
  processing_level: string;
  quality_control_applied: boolean;
  data_mode?: CanonicalDataMode;
  platform_type?: ObservationPlatformType;
  vertical_coverage_type?: VerticalCoverageType;
  supports_3d?: boolean;
  supports_surface?: boolean;
  supports_subset?: boolean;
  credential_requirement?: string;
  qc_details?: string;
  documentation_url?: string;
  citation?: string;
}

export interface CanonicalVariable {
  id: string;
  display_name: string;
  cf_standard_name?: string;
  unit: string;
  category: 'thermodynamic' | 'dynamic' | 'biogeochemical' | 'coordinate';
  description: string;
  valid_range: [number, number];
  is_derived: boolean;
  derived_expression?: string;
  aliases: string[];
}

export interface NormalizedDataRecord {
  source: string;
  source_name: string;
  product_id?: string;
  product_name?: string;
  dataset_id: string;
  dataset_name: string;
  variable: string;
  variable_name: string;
  units: string;
  data_mode?: CanonicalDataMode;
  platform_type?: ObservationPlatformType;
  vertical_coverage_type?: VerticalCoverageType;
  observed_at?: string;
  model_valid_at?: string;
  retrieved_at: string;
  latitude: number;
  longitude: number;
  depth?: number;
  pressure?: number;
  value?: number;
  model_value?: number;
  observation_value?: number;
  difference?: number;
  data_kind?: DataKind;
  qc_status?: Record<string, any> | string;
  provenance: Record<string, any>;
  temporal_resolution?: string;
  spatial_resolution?: string;
  vertical_resolution?: string;
  processing_level?: string;
  availability_status: string;
}

export interface UnifiedProfileLevel {
  depth?: number;
  pressure?: number;
  temperature?: number;
  salinity?: number;
  value?: number;
  pressure_qc?: string;
  temperature_qc?: string;
  salinity_qc?: string;
  qc_flag?: string;
  qc_accepted?: boolean;
}

export interface UnifiedProfileRecord {
  available: boolean;
  profile_id: string;
  platform_id?: string;
  platform_type?: ObservationPlatformType;
  cycle_number?: number;
  latitude: number;
  longitude: number;
  observed_at: string;
  retrieved_at: string;
  data_mode?: Record<string, string> | CanonicalDataMode;
  value_source?: Record<string, string>;
  levels: UnifiedProfileLevel[];
  qc?: Record<string, any>;
  provenance: Record<string, any>;
}

export interface CurrentsVectorPoint {
  depth: number;
  uo: number;
  vo: number;
  speed: number;
  direction: number;
  source?: string;
  data_mode?: CanonicalDataMode;
}

export interface HistoricalDataRequest {
  source?: string;
  dataset_id: string;
  variable?: string;
  start_datetime?: string;
  end_datetime?: string;
  date?: string;
  time?: string;
  latitude_min?: number;
  latitude_max?: number;
  longitude_min?: number;
  longitude_max?: number;
  depth_min?: number;
  depth_max?: number;
  pressure_min?: number;
  pressure_max?: number;
  temporal_resolution?: string;
  format?: 'records' | 'profiles' | 'collocation' | 'grid';
}

export interface HistoricalQuerySummary {
  source?: string;
  dataset_id: string;
  dataset_name: string;
  variable?: string;
  variable_name?: string;
  units?: string;
  requested_time: {
    date?: string;
    time?: string;
    start?: string;
    end?: string;
  };
  requested_region: {
    lat_min?: number;
    lat_max?: number;
    lon_min?: number;
    lon_max?: number;
  };
  requested_depth: {
    depth_min?: number;
    depth_max?: number;
    pressure_min?: number;
    pressure_max?: number;
  };
}

export interface HistoricalResultSummary {
  status: 'complete' | 'partial' | 'no_data' | 'access_required';
  total_records: number;
  returned_time_range?: {
    start: string;
    end: string;
  };
  returned_spatial_bounds?: {
    south: number;
    north: number;
    west: number;
    east: number;
  };
  returned_depth_range?: [number, number];
  units?: string;
  qc_summary?: Record<string, any>;
  data_status_note?: string;
}

export interface HistoricalDataResponse {
  status: 'success' | 'partial' | 'no_data' | 'error';
  mode: 'historical';
  query_summary: HistoricalQuerySummary;
  result_summary: HistoricalResultSummary;
  data: NormalizedDataRecord[] | UnifiedProfileRecord[] | any[];
  provenance: Record<string, any>;
  cache?: {
    hit: boolean;
    cached_at: string;
    ttl_seconds: number;
  };
  metadata: {
    timestamp: string;
    source: string;
    requestId?: string;
  };
}
