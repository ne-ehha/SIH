import { useState, useEffect } from 'react';
import { fetchModelHealth } from '@/services/modelService';
import type { ModelHealth } from '@/types/model';
import { LoadingState } from '@/components/common/LoadingState';

export function ModelHealthCard() {
  const [health, setHealth] = useState<ModelHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModelHealth()
      .then(setHealth)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Checking model health..." />;
  if (!health) return null;

  const scoreColor =
    health.score >= 80
      ? 'text-green-400'
      : health.score >= 60
      ? 'text-yellow-400'
      : 'text-red-400';

  const scoreRing =
    health.score >= 80
      ? 'border-green-500/30'
      : health.score >= 60
      ? 'border-yellow-500/30'
      : 'border-red-500/30';

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (health.score / 100) * circumference;

  return (
    <div className="rounded-xl border border-slate-700/50 bg-[#0d1224]/90 p-4 shadow-xl backdrop-blur-md">
      <h3 className="mb-3 text-sm font-semibold text-white">Model Health</h3>
      <div className="flex items-center gap-4">
        {/* Score circle */}
        <div className={`relative h-24 w-24 rounded-full border-2 ${scoreRing}`}>
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#1e293b"
              strokeWidth="6"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              className={scoreColor}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-xl font-bold ${scoreColor}`}>{health.score}</span>
            <span className="text-[8px] text-slate-500">/ 100</span>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${
              health.status === 'excellent' || health.status === 'good'
                ? 'bg-green-400'
                : health.status === 'fair'
                ? 'bg-yellow-400'
                : 'bg-red-400'
            }`} />
            <span className="text-sm font-medium text-white capitalize">{health.status}</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">{health.summary}</p>
        </div>
      </div>
    </div>
  );
}
