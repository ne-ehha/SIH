/**
 * INTEG1 Integration Layer — useDiscrepancy Hook
 *
 * Fetches discrepancy data for a region and adapts it for the DiscrepancyMap component.
 *
 * Flow:
 *   Region + bounds + variable + date + time
 *     → getProvider().fetchDiscrepancy()
 *       → adaptDiscrepancy() + adaptDiscrepancyStats()
 *         → { discrepancyPoints, stats, loading, error, refetch }
 */

import { useState, useEffect, useCallback } from 'react';
import { getProvider } from '../registry';
import { adaptDiscrepancy, adaptDiscrepancyStats, type DiscrepancyDisplayPoint } from '../adapters';
import type { OceanVariable, Bounds } from '../types';
import { regions } from '@/config/regions';

interface UseDiscrepancyParams {
  regionId: string;
  variable: OceanVariable;
  date: string;
  time: string;
}

interface DiscrepancyStats {
  meanError: number;
  maxError: number;
  rmsError: number;
  totalPoints: number;
}

interface UseDiscrepancyResult {
  discrepancyPoints: DiscrepancyDisplayPoint[];
  stats: DiscrepancyStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDiscrepancy({
  regionId,
  variable,
  date,
  time,
}: UseDiscrepancyParams): UseDiscrepancyResult {
  const [discrepancyPoints, setDiscrepancyPoints] = useState<DiscrepancyDisplayPoint[]>([]);
  const [stats, setStats] = useState<DiscrepancyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const region = regions.find((r) => r.id === regionId);
    if (!region) {
      setError('Invalid region');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const provider = getProvider();
      const response = await provider.fetchDiscrepancy({
        region: regionId,
        bounds: region.bounds,
        variable,
        date,
        time,
      });

      if (response.status === 'error') {
        setError(response.error || 'Failed to fetch discrepancy data');
      } else {
        setDiscrepancyPoints(adaptDiscrepancy(response));
        setStats(adaptDiscrepancyStats(response));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }, [regionId, variable, date, time]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { discrepancyPoints, stats, loading, error, refetch: fetchData };
}
