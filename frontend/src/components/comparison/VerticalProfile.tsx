import { useState, useEffect } from 'react';
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
import { fetchVerticalProfile } from '@/services/oceanService';
import type { VerticalProfilePoint } from '@/types/model';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';

export function VerticalProfile() {
  const { selectedLocation, selectedVariable } = useOceanStore();
  const [profileData, setProfileData] = useState<VerticalProfilePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!selectedLocation) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchVerticalProfile(selectedLocation, selectedVariable);
      setProfileData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLocation) {
      loadData();
    }
  }, [selectedLocation, selectedVariable]);

  if (!selectedLocation) {
    return <EmptyState message="Select a location to view vertical profile" icon="📊" />;
  }

  if (loading) return <LoadingState message="Loading vertical profile..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;
  if (profileData.length === 0) return <EmptyState message="No profile data available" />;

  // Invert depth for oceanographic convention (0 at top, deeper at bottom)
  const chartData = profileData.map((point) => ({
    ...point,
    depthLabel: `${point.depth}m`,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Vertical Profile</h3>
        <span className="text-[10px] text-slate-500">Mock data — Backend pending</span>
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
            <Line type="monotone" dataKey="modelValue" stroke="#06b6d4" strokeWidth={2} name="Model" dot={false} />
            <Line type="monotone" dataKey="observationValue" stroke="#a855f7" strokeWidth={2} name="Observation" dot={false} strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
