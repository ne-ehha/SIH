import { useState } from 'react';
import { mockDiscrepancyData } from '@/mocks/comparison';

export function DiscrepancyMap() {
  const [selectedVar, setSelectedVar] = useState<'all' | 'temperature' | 'salinity'>('all');

  const filteredData =
    selectedVar === 'all'
      ? mockDiscrepancyData
      : mockDiscrepancyData.filter((d) => d.variable === selectedVar);

  const maxError = Math.max(...filteredData.map((d) => Math.abs(d.errorMagnitude)));

  const getErrorColor = (magnitude: number) => {
    const normalized = magnitude / maxError;
    if (magnitude > 0) {
      return `rgba(239, 68, 68, ${Math.abs(normalized) * 0.8})`;
    } else {
      return `rgba(59, 130, 246, ${Math.abs(normalized) * 0.8})`;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Discrepancy Map</h3>
        <div className="flex gap-1">
          {(['all', 'temperature', 'salinity'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setSelectedVar(v)}
              className={`rounded px-2 py-0.5 text-[10px] transition ${
                selectedVar === v
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap visualization */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <div className="grid grid-cols-10 gap-1">
          {filteredData.map((point, i) => (
            <div
              key={i}
              className="group relative aspect-square rounded-sm cursor-pointer transition-transform hover:scale-110"
              style={{ backgroundColor: getErrorColor(point.errorMagnitude) }}
              title={`${point.latitude.toFixed(1)}°N, ${point.longitude.toFixed(1)}°E\nDepth: ${point.depth}m\nError: ${point.errorMagnitude > 0 ? '+' : ''}${point.errorMagnitude.toFixed(1)}°C`}
            >
              {/* Tooltip */}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[9px] text-white shadow-lg group-hover:block">
                {point.errorMagnitude > 0 ? '+' : ''}{point.errorMagnitude.toFixed(1)}°C
              </div>
            </div>
          ))}
        </div>

        {/* Color scale */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="text-[10px] text-blue-400">Negative</span>
          <div className="h-2 w-32 rounded-full bg-gradient-to-r from-blue-500 via-slate-700 to-red-500" />
          <span className="text-[10px] text-red-400">Positive</span>
        </div>

        <p className="mt-2 text-center text-[10px] text-slate-500">
          Mock discrepancy data — Backend pending
        </p>
      </div>
    </div>
  );
}
