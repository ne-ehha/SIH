import { useState, useEffect } from 'react';
import { useOceanStore } from '@/state/oceanStore';
import { fetchModelComparison } from '@/services/modelService';
import type { ModelComparison } from '@/types/model';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { DifferenceCard } from './DifferenceCard';

export function ModelObservationComparison() {
  const { selectedLocation, selectedVariable, selectedDepth } = useOceanStore();
  const [comparison, setComparison] = useState<ModelComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!selectedLocation) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchModelComparison(selectedLocation, selectedVariable, selectedDepth);
      setComparison(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLocation) {
      loadData();
    }
  }, [selectedLocation, selectedVariable, selectedDepth]);

  if (!selectedLocation) {
    return <EmptyState message="Select a location on the globe to view comparison" icon="📍" />;
  }

  if (loading) return <LoadingState message="Loading comparison data..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;
  if (!comparison) return <EmptyState message="No comparison data available" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Model vs Observation</h3>
        <span className="text-[10px] text-slate-500">Real API data</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <DifferenceCard
          label="Model"
          value={comparison.modelValue}
          unit={comparison.unit}
          color="cyan"
        />
        <DifferenceCard
          label="Observed"
          value={comparison.observationValue}
          unit={comparison.unit}
          color="purple"
        />
        <DifferenceCard
          label="Difference"
          value={comparison.difference}
          unit={comparison.unit}
          color={comparison.difference >= 0 ? 'green' : 'red'}
          showSign
        />
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
        <p className="text-[10px] text-slate-500">
          Variable: {comparison.variable} at {selectedDepth}m depth
        </p>
      </div>
    </div>
  );
}
