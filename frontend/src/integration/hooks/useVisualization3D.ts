/**
 * INTEG1 Integration Layer — useVisualization3D Hook
 *
 * Fetches 3D visualization data (surface grid, depth slices, vertical profile)
 * and adapts it for the Ocean3DView sub-components.
 *
 * Flow:
 *   Coordinates + variable + date + time
 *     → getProvider().fetchVisualization()
 *       → adaptSurfaceLayer() + adaptDepthSlices() + adaptProfileForChart()
 *         → { surfaceGrid, depthSlices, profileChart, loading, error, refetch }
 */

import { useState, useEffect, useCallback } from 'react';
import { getProvider } from '../registry';
import {
  adaptSurfaceLayer,
  adaptDepthSlices,
  adaptProfileForChart,
  type SurfaceGridCell,
  type DepthSliceDisplay,
  type ProfileChartPoint,
} from '../adapters';
import type { OceanVariable } from '../types';

interface UseVisualization3DParams {
  latitude: number | null;
  longitude: number | null;
  variable: OceanVariable;
  date: string;
  time: string;
}

interface UseVisualization3DResult {
  surfaceGrid: SurfaceGridCell[];
  depthSlices: DepthSliceDisplay[];
  profileChart: ProfileChartPoint[];
  unit: string;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useVisualization3D({
  latitude,
  longitude,
  variable,
  date,
  time,
}: UseVisualization3DParams): UseVisualization3DResult {
  const [surfaceGrid, setSurfaceGrid] = useState<SurfaceGridCell[]>([]);
  const [depthSlices, setDepthSlices] = useState<DepthSliceDisplay[]>([]);
  const [profileChart, setProfileChart] = useState<ProfileChartPoint[]>([]);
  const [unit, setUnit] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (latitude === null || longitude === null) {
      setSurfaceGrid([]);
      setDepthSlices([]);
      setProfileChart([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const provider = getProvider();
      const response = await provider.fetchVisualization({
        location: { latitude, longitude },
        variable,
        date,
        time,
      });

      if (response.status === 'error') {
        setError(response.error || 'Failed to fetch visualization data');
      } else if (response.data) {
        setSurfaceGrid(adaptSurfaceLayer(response));
        setDepthSlices(adaptDepthSlices(response));
        setProfileChart(adaptProfileForChart(response));
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

  return { surfaceGrid, depthSlices, profileChart, unit, loading, error, refetch: fetchData };
}
