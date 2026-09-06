/**
 * INTEG1 Integration Layer — useResearchVisualization3D Hook
 *
 * Fetches Research 3D visualization data (GLORYS × Argo collocated observations)
 * and returns the raw point cloud for the Research3DView component.
 *
 * Flow:
 *   Coordinates + variable + date + time
 *     → getProvider().fetchResearchVisualization()
 *       → { points, stats, unit, loading, error, refetch }
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getProvider } from '../registry';
import type { OceanVariable, ProviderResponse, Research3DPoint, Research3DStats, ResearchVisualization3DResult } from '../types';
import { findNearestResearchMeasurement } from '../researchSelection';

const researchRequestCache = new Map<string, Promise<ProviderResponse<ResearchVisualization3DResult>>>();

interface UseResearchVisualization3DParams {
  latitude: number | null;
  longitude: number | null;
  variable: OceanVariable;
  date: string;
  time: string;
  selectedObservationId: string | null;
  selectedDepth?: number;
  enabled?: boolean;
}

interface UseResearchVisualization3DResult {
  points: Research3DPoint[];
  selectedProfilePoints: Research3DPoint[];
  selectedMeasurement: Research3DPoint | null;
  stats: Research3DStats | null;
  unit: string;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useResearchVisualization3D({
  latitude,
  longitude,
  variable,
  date,
  time,
  selectedObservationId,
  selectedDepth = 0,
  enabled = true,
}: UseResearchVisualization3DParams): UseResearchVisualization3DResult {
  const [points, setPoints] = useState<Research3DPoint[]>([]);
  const [stats, setStats] = useState<Research3DStats | null>(null);
  const [unit, setUnit] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!enabled || latitude === null || longitude === null) {
      setPoints([]);
      setStats(null);
      setUnit('');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cacheKey = `${latitude}|${longitude}|${variable}|${date}|${time}`;
      if (forceRefresh) researchRequestCache.delete(cacheKey);
      let request = researchRequestCache.get(cacheKey);
      if (!request) {
        const provider = getProvider();
        request = provider.fetchResearchVisualization({
          location: { latitude, longitude },
          variable,
          date,
          time,
        });
        researchRequestCache.set(cacheKey, request);
      }
      const response = await request;

      if (response.status === 'error') {
        setError(response.error || 'Failed to fetch Research visualization data');
      } else if (response.data) {
        setPoints(response.data.points);
        setStats(response.data.stats);
        setUnit(response.data.unit);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, variable, date, time, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter to the selected Argo profile by platformNumber + cycleNumber.
  // Observation IDs follow the format "argo_{platformNumber}_{cycleNumber}"
  // e.g. "argo_1902669_12". The research API returns cycleNumber as "12.0"
  // while observations endpoint uses "12", so matching must be numeric.
  const selectedProfilePoints = useMemo<Research3DPoint[]>(() => {
    if (!selectedObservationId) return [];
    if (points.length === 0) return [];

    const parts = selectedObservationId.split('_');
    // parts: ['argo', platformNumber, cycleNumber]
    if (parts.length < 3) return [];

    const targetPlatform = parts[1];
    const targetCycle = parseFloat(parts[2]);
    if (isNaN(targetCycle)) return [];

    return points.filter((p) => {
      return (
        p.platformNumber === targetPlatform &&
        parseFloat(p.cycleNumber) === targetCycle
      );
    });
  }, [points, selectedObservationId]);

  const selectedMeasurement = useMemo(
    () => findNearestResearchMeasurement(selectedProfilePoints, selectedDepth),
    [selectedProfilePoints, selectedDepth],
  );

  return {
    points,
    selectedProfilePoints,
    selectedMeasurement,
    stats,
    unit,
    loading,
    error,
    refetch: () => fetchData(true),
  };
}
