import { useOceanStore } from '@/state/oceanStore';
import { useResearchVisualization3D } from '@/integration';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { DifferenceCard } from './DifferenceCard';

export function ModelObservationComparison() {
  const {
    selectedLocation,
    selectedVariable,
    selectedDepth,
    selectedDate,
    selectedTime,
    selectedObservationId,
  } = useOceanStore();
  const { selectedMeasurement, unit, loading, error, refetch } = useResearchVisualization3D({
    latitude: selectedLocation?.latitude ?? null,
    longitude: selectedLocation?.longitude ?? null,
    variable: selectedVariable,
    date: selectedDate,
    time: selectedTime,
    selectedObservationId,
    selectedDepth,
    enabled: Boolean(selectedObservationId),
  });

  if (!selectedLocation) {
    return <EmptyState message="Select a location on the globe to view comparison" icon="📍" />;
  }

  if (!selectedObservationId) {
    return <EmptyState message="Select a real Argo observation marker to view its comparison" />;
  }

  if (loading) return <LoadingState message="Loading selected observation comparison..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!selectedMeasurement) return <EmptyState message={`No real measurement is within 50 dbar of ${selectedDepth}m`} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--os-text)' }}>Model vs Observation</h3>
        <span className="text-[10px]" style={{ color: 'var(--os-text-3)' }}>Real API data</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <DifferenceCard
          label="Argo"
          value={selectedMeasurement.argoValue}
          unit={unit}
          color="argo"
        />
        <DifferenceCard
          label="GLORYS12V1"
          value={selectedMeasurement.glorysValue}
          unit={unit}
          color="glorys"
        />
        <DifferenceCard
          label="GLORYS − Argo"
          value={selectedMeasurement.difference}
          unit={unit}
          color={selectedMeasurement.difference >= 0 ? 'diff-pos' : 'diff-neg'}
          showSign
        />
      </div>

      <div className="border p-3" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
        <p className="text-[10px]" style={{ color: 'var(--os-text-3)' }}>
          Compared at <span className="mono" style={{ color: 'var(--os-text-2)' }}>{selectedMeasurement.pressure.toFixed(1)} dbar</span>
          {' '}(slider set to {selectedDepth}m)
        </p>
      </div>
    </div>
  );
}
