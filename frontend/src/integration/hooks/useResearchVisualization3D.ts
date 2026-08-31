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

import { useState, useEffect, useCallback } from 'react';
import { getProvider } from '../registry';
import type { OceanVariable, Research3DPoint, Research3DStats } from '../types';

interface UseResearchVisualization3DParams {
  latitude: number | null;
  longitude: number | null;
  variable: OceanVariable;
  date: string;
  time: string;
}

interface UseResearchVisualization3DResult {
  points: Research3DPoint[];
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
}: UseResearchVisualization3DParams): UseResearchVisualization3DResult {
  const [points, setPoints] = useState<Research3DPoint[]>([]);
  const [stats, setStats] = useState<Research3DStats | null>(null);
  const [unit, setUnit] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (latitude === null || longitude === null) {
      setPoints([]);
      setStats(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const provider = getProvider();
      const response = await provider.fetchResearchVisualization({
        location: { latitude, longitude },
        variable,
        date,
        time,
      });

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
  }, [latitude, longitude, variable, date, time]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { points, stats, unit, loading, error, refetch: fetchData };
}
