import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useOceanStore } from '@/state/oceanStore';
import { useResearchVisualization3D } from '@/integration';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';

export function VerticalProfile() {
  const {
    selectedLocation,
    selectedVariable,
    selectedDate,
    selectedTime,
    selectedDepth,
    selectedObservationId,
  } = useOceanStore();
  const { selectedProfilePoints, selectedMeasurement, loading, error, refetch } = useResearchVisualization3D({
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
    return <EmptyState message="Select a location to view vertical profile" icon="📊" />;
  }

  if (!selectedObservationId) {
    return <EmptyState message="Select a real Argo observation marker to view its profile" />;
  }

  if (loading) return <LoadingState message="Loading selected vertical profile..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (selectedProfilePoints.length === 0) return <EmptyState message="No selected profile data available" />;

  // Invert depth for oceanographic convention (0 at top, deeper at bottom)
  const chartData = selectedProfilePoints.map((point) => ({
    depth: point.pressure,
    depthLabel: `${point.pressure.toFixed(1)}m`,
    modelValue: point.glorysValue,
    observationValue: point.argoValue,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--os-text)' }}>Vertical Profile</h3>
        <span className="text-[10px]" style={{ color: 'var(--os-text-3)' }}>Real API data</span>
      </div>

      <div className="h-64 rounded-lg border p-4" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              type="number"
              tick={{ fill: 'var(--os-text-3)', fontSize: 10 }}
              label={{ value: 'Value', position: 'bottom', fill: 'var(--os-text-3)', fontSize: 10 }}
            />
            <YAxis
              type="category"
              dataKey="depthLabel"
              tick={{ fill: 'var(--os-text-3)', fontSize: 10 }}
              label={{ value: 'Depth', angle: -90, position: 'insideLeft', fill: 'var(--os-text-3)', fontSize: 10 }}
              reversed
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--os-surface)',
                border: '1px solid var(--os-border)',
                borderRadius: '8px',
                fontSize: '11px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Line type="monotone" dataKey="modelValue" stroke="#a855f7" strokeWidth={2} name="GLORYS" dot={false} />
            <Line type="monotone" dataKey="observationValue" stroke="#22d3ee" strokeWidth={2} name="Argo" dot={false} strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {selectedMeasurement && (
        <p className="text-[10px] mono" style={{ color: 'var(--os-selected)' }}>
          Selected real record: {selectedMeasurement.pressure.toFixed(1)} dbar (slider {selectedDepth}m)
        </p>
      )}
    </div>
  );
}
