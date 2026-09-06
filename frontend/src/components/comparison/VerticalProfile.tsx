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
        <h3 className="text-sm font-semibold text-white">Vertical Profile</h3>
        <span className="text-[10px] text-slate-500">Real API data</span>
      </div>

      <div className="h-64 rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'Value', position: 'bottom', fill: '#64748b', fontSize: 10 }} />
            <YAxis
              type="category"
              dataKey="depthLabel"
              tick={{ fill: '#64748b', fontSize: 10 }}
              label={{ value: 'Depth', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
              reversed
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0d1224',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                fontSize: '11px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Line type="monotone" dataKey="modelValue" stroke="#06b6d4" strokeWidth={2} name="GLORYS" dot={false} />
            <Line type="monotone" dataKey="observationValue" stroke="#a855f7" strokeWidth={2} name="Argo" dot={false} strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {selectedMeasurement && (
        <p className="text-[10px] text-cyan-300">
          Selected real record: {selectedMeasurement.pressure.toFixed(1)} dbar (slider {selectedDepth}m)
        </p>
      )}
    </div>
  );
}
