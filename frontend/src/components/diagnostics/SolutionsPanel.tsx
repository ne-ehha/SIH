import { useState, useEffect } from 'react';
import { useOceanStore } from '@/state/oceanStore';
import { getRecommendations } from '@/services/diagnosticsService';
import type { SolutionRecommendation } from '@/types/diagnostics';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';

export function SolutionsPanel() {
  const { selectedLocation } = useOceanStore();
  const [solution, setSolution] = useState<SolutionRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!selectedLocation) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getRecommendations('diag-001');
      setSolution(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recommendations unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLocation) {
      loadData();
    }
  }, [selectedLocation]);

  if (!selectedLocation) {
    return <EmptyState message="Select a location to view recommendations" icon="💡" />;
  }

  if (loading) return <LoadingState message="Loading recommendations..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;
  if (!solution) return <EmptyState message="No recommendations available" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Solutions & Recommendations</h3>
        <span className="text-[10px] text-slate-500">Mock data — Backend pending</span>
      </div>

      <div className="rounded-xl border border-purple-800/50 bg-purple-900/20 p-5">
        <div className="space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-purple-400/60">Recommended Investigation</p>
            <p className="mt-1 text-sm text-purple-200">{solution.recommendedTest}</p>
          </div>

          <div className="border-t border-purple-800/30 pt-3">
            <p className="text-[10px] uppercase tracking-wider text-cyan-400/60">Expected Outcome</p>
            <p className="mt-1 text-sm text-cyan-200">{solution.expectedOutcome}</p>
          </div>

          <div className="rounded-lg border border-amber-800/50 bg-amber-900/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-amber-500">⚠ Caution</p>
            <p className="mt-1 text-xs text-amber-300/80 italic">{solution.caution}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
