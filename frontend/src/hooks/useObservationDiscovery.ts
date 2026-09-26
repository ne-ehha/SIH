import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOceanStore } from '@/state/oceanStore';
import { discoverObservations, type ObservationDiscoveryParams } from '@/services/observationDiscoveryService';
import type {
  ObservationDiscoveryResponse,
  CanonicalProfileObservation,
  CanonicalObservationPoint,
} from '@/types/observation';
import type { ObservationPlatformType } from '@/types/unifiedData';

export interface UseObservationDiscoveryResult {
  discovery: ObservationDiscoveryResponse | null;
  selectedProfile: CanonicalProfileObservation | null;
  observationPoints: CanonicalObservationPoint[];
  availableVariables: string[];
  loading: boolean;
  error: string | null;
  isVariableAvailable: (variable: string) => boolean;
  refetch: () => Promise<void>;
  status: ObservationDiscoveryResponse['status'] | 'IDLE';
  spatialOffsetKm: number | null;
  temporalOffsetHours: number | null;
  candidateCount: number;
  provenance: Record<string, unknown> | null;
}

export function useObservationDiscovery(options?: {
  variableOverride?: string;
  platformOverride?: ObservationPlatformType;
  enabled?: boolean;
}): UseObservationDiscoveryResult {
  const {
    selectedLocation,
    selectedVariable,
    selectedDate,
    selectedTime,
    selectedPlatform,
    canonicalDataMode,
  } = useOceanStore();

  const [discovery, setDiscovery] = useState<ObservationDiscoveryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeVariable = options?.variableOverride ?? selectedVariable;
  const activePlatform = options?.platformOverride ?? (selectedPlatform as ObservationPlatformType);
  const enabled = options?.enabled ?? true;

  // Bay of Bengal default center if no point is currently selected
  const lat = selectedLocation?.latitude ?? 14.5;
  const lon = selectedLocation?.longitude ?? 87.2;
  const targetDt = selectedDate ? `${selectedDate}T${selectedTime || '12:00'}:00Z` : undefined;

  const performDiscovery = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    const params: ObservationDiscoveryParams = {
      latitude: lat,
      longitude: lon,
      target_datetime: targetDt,
      platform: activePlatform !== 'ALL' ? activePlatform : undefined,
      variable: activeVariable,
      radius_km: 350.0,
      max_temporal_hours: 720.0, // 30 days window
      data_mode: canonicalDataMode,
    };

    try {
      const resp = await discoverObservations(params);
      setDiscovery(resp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Observation discovery failed');
      setDiscovery(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, lat, lon, targetDt, activePlatform, activeVariable, canonicalDataMode]);

  useEffect(() => {
    performDiscovery();
  }, [performDiscovery]);

  const availableVariables = useMemo(() => {
    return discovery?.available_variables ?? [];
  }, [discovery]);

  const isVariableAvailable = useCallback(
    (varName: string) => {
      if (!discovery || !discovery.available_variables) return false;
      const normalized = varName.toLowerCase();
      return (
        discovery.available_variables.includes(normalized) ||
        discovery.available_variables.includes(
          normalized === 'temperature' ? 'thetao' : normalized === 'salinity' ? 'so' : normalized
        )
      );
    },
    [discovery]
  );

  const selectedProfile = discovery?.selected_profile ?? null;
  const observationPoints = discovery?.observations ?? [];

  return {
    discovery,
    selectedProfile,
    observationPoints,
    availableVariables,
    loading,
    error,
    isVariableAvailable,
    refetch: performDiscovery,
    status: discovery?.status ?? 'IDLE',
    spatialOffsetKm: discovery?.matching?.spatial_offset_km ?? null,
    temporalOffsetHours: discovery?.matching?.temporal_offset_hours ?? null,
    candidateCount: discovery?.candidate_profiles_count ?? 0,
    provenance: discovery?.provenance ?? null,
  };
}
