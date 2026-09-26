import type { ObservationDiscoveryResponse } from '@/types/observation';
import type { CanonicalDataMode, ObservationPlatformType } from '@/types/unifiedData';

export interface ObservationDiscoveryParams {
  latitude: number;
  longitude: number;
  target_datetime?: string;
  start_datetime?: string;
  end_datetime?: string;
  platform?: ObservationPlatformType;
  variable?: string;
  radius_km?: number;
  max_temporal_hours?: number;
  profile_id?: string;
  data_mode?: CanonicalDataMode;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const discoveryCache = new Map<string, { response: ObservationDiscoveryResponse; timestamp: number }>();
const pendingRequests = new Map<string, Promise<ObservationDiscoveryResponse>>();
const CACHE_TTL_MS = 60_000; // 60 seconds client-side cache

function buildCacheKey(params: ObservationDiscoveryParams): string {
  return [
    params.latitude.toFixed(2),
    params.longitude.toFixed(2),
    params.platform || 'ALL',
    params.variable || 'ALL',
    params.profile_id || 'ALL',
    params.data_mode || 'ALL',
    params.target_datetime || params.start_datetime || 'LATEST',
    (params.radius_km ?? 300).toFixed(0),
  ].join('|');
}

export async function discoverObservations(
  params: ObservationDiscoveryParams
): Promise<ObservationDiscoveryResponse> {
  const cacheKey = buildCacheKey(params);
  const now = Date.now();

  const cached = discoveryCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.response;
  }

  const inFlight = pendingRequests.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const queryParams = new URLSearchParams();
  queryParams.set('latitude', params.latitude.toString());
  queryParams.set('longitude', params.longitude.toString());
  if (params.platform && params.platform !== 'ALL') {
    queryParams.set('platform', params.platform);
  }
  if (params.variable) {
    queryParams.set('variable', params.variable);
  }
  if (params.profile_id) {
    queryParams.set('profile_id', params.profile_id);
  }
  if (params.target_datetime) {
    queryParams.set('target_datetime', params.target_datetime);
  }
  if (params.start_datetime) {
    queryParams.set('start_datetime', params.start_datetime);
  }
  if (params.end_datetime) {
    queryParams.set('end_datetime', params.end_datetime);
  }
  if (params.radius_km !== undefined) {
    queryParams.set('radius_km', params.radius_km.toString());
  }
  if (params.max_temporal_hours !== undefined) {
    queryParams.set('max_temporal_hours', params.max_temporal_hours.toString());
  }
  if (params.data_mode) {
    queryParams.set('data_mode', params.data_mode);
  }

  const requestPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/observations/discover?${queryParams.toString()}`);
      if (!res.ok) {
        throw new Error(`Discovery request failed with HTTP ${res.status}`);
      }
      const data: ObservationDiscoveryResponse = await res.json();
      discoveryCache.set(cacheKey, { response: data, timestamp: Date.now() });
      return data;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

export interface DatasetProfileSummary {
  profile_id: string;
  platform_id: string;
  platform_type: string;
  cycle_number?: number;
  latitude: number;
  longitude: number;
  observation_time: string;
  variables: string[];
  min_depth: number;
  max_depth: number;
  levels_count: number;
  qc_status: string;
  source: string;
  source_dataset: string;
  file_path?: string;
  file_size_bytes?: number;
  sha256?: string;
  institution?: string;
  processing_level?: string;
}

export interface DatasetProfilesResponse {
  platform: string;
  dataset_id: string;
  dataset_name: string;
  total_profiles: number;
  temporal_range: { start: string; end: string };
  spatial_bounds: { min_lat: number; max_lat: number; min_lon: number; max_lon: number };
  depth_range: { min_depth: number; max_depth: number };
  available_variables: string[];
  available_dates?: string[];
  profiles: DatasetProfileSummary[];
}

export async function fetchDatasetProfiles(
  platform?: string,
  dataMode?: string
): Promise<DatasetProfilesResponse> {
  const queryParams = new URLSearchParams();
  if (platform && platform !== 'ALL') {
    queryParams.set('platform', platform);
  }
  if (dataMode) {
    queryParams.set('data_mode', dataMode);
  }
  const res = await fetch(`${API_BASE_URL}/api/v1/observations/profiles?${queryParams.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch dataset profiles (HTTP ${res.status})`);
  }
  return res.json();
}

export function clearDiscoveryCache(): void {
  discoveryCache.clear();
  pendingRequests.clear();
}

