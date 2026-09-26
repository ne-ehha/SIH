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

  // Robust profile matching across all platforms (Argo, BGC, Glider, CTD)
  const selectedProfilePoints = useMemo<Research3DPoint[]>(() => {
    if (points.length === 0) return [];

    if (selectedObservationId) {
      const cleanId = selectedObservationId.replace(/^(latest_|argo_|bgc_argo_|glider_|ctd_)/i, '');
      const tokens = cleanId.split('_');
      const targetPlatform = tokens[0];
      const targetCycleStr = tokens[tokens.length - 1].replace(/\D/g, '');
      const targetCycle = targetCycleStr ? parseFloat(targetCycleStr) : NaN;

      const matched = points.filter((p) => {
        const platMatch =
          p.platformNumber === targetPlatform ||
          p.platformNumber.includes(targetPlatform) ||
          targetPlatform.includes(p.platformNumber);
        if (!platMatch) return false;
        if (!isNaN(targetCycle)) {
          return Math.abs(parseFloat(p.cycleNumber) - targetCycle) < 0.1;
        }
        return true;
      });

      if (matched.length > 0) return matched;
    }

    // Fallback: match by proximity to selected coordinate
    if (latitude !== null && longitude !== null) {
      const closest = points.reduce((best, curr) => {
        const dCurr = Math.hypot(curr.latitude - latitude, curr.longitude - longitude);
        const dBest = Math.hypot(best.latitude - latitude, best.longitude - longitude);
        return dCurr < dBest ? curr : best;
      }, points[0]);
      if (closest && Math.hypot(closest.latitude - latitude, closest.longitude - longitude) < 1.5) {
        return points.filter(
          (p) => p.platformNumber === closest.platformNumber && p.cycleNumber === closest.cycleNumber
        );
      }
    }

    return [];
  }, [points, selectedObservationId, latitude, longitude]);

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
