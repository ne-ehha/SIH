import { useState, useEffect } from 'react';
import { useOceanStore } from '@/state/oceanStore';
import { getProvider } from '@/integration';
import { regions } from '@/config/regions';
import type { DiscrepancyData } from '@/types/diagnostics';

export function DiscrepancyMap() {
  const { selectedVariable, selectedRegion, selectedDate, selectedTime } = useOceanStore();
  const [selectedVar, setSelectedVar] = useState<'all' | 'temperature' | 'salinity'>('all');
  const [allData, setAllData] = useState<DiscrepancyData[]>([]);

  // Fetch real discrepancy data from the API
  useEffect(() => {
    const provider = getProvider();
    const region = regions.find(r => r.id === selectedRegion);
    if (!region) return;

    provider.fetchDiscrepancy({
      region: selectedRegion,
      bounds: region.bounds,
      variable: selectedVariable,
      date: selectedDate,
      time: selectedTime,
    }).then(response => {
      if (response.status === 'success' && response.data) {
        setAllData(response.data.points as DiscrepancyData[]);
      }
    }).catch(() => setAllData([]));
  }, [selectedRegion, selectedVariable, selectedDate, selectedTime]);

  const filteredData =
    selectedVar === 'all'
      ? allData
      : allData.filter((d) => d.variable === selectedVar);

  const maxError = filteredData.length > 0 ? Math.max(...filteredData.map((d) => Math.abs(d.errorMagnitude))) : 1;

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
        <div>
          <h3 className="text-sm font-semibold text-white">Discrepancy Map</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">GLORYS12V1 − Argo Delayed Mode | {selectedDate}</p>
        </div>
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

      {/* Observation points visualization */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        {filteredData.length === 0 ? (
          <p className="text-center text-xs text-slate-500 py-8">No discrepancy data available for this selection.</p>
        ) : (
          <>
            {/* Point list with geographic context */}
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {filteredData.slice(0, 30).map((point, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-slate-800/30"
                >
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: getErrorColor(point.errorMagnitude) }}
                  />
                  <div className="flex-1 grid grid-cols-4 gap-2 text-[10px]">
                    <span className="text-slate-400">{point.latitude.toFixed(2)}°N, {point.longitude.toFixed(2)}°E</span>
                    <span className="text-slate-400">{point.depth.toFixed(0)} dbar</span>
                    <span className="text-slate-400">{point.variable}</span>
                    <span className={point.errorMagnitude >= 0 ? 'text-red-400' : 'text-blue-400'}>
                      {point.errorMagnitude > 0 ? '+' : ''}{point.errorMagnitude.toFixed(4)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {filteredData.length > 30 && (
              <p className="text-[9px] text-slate-600 text-center mt-2">Showing 30 of {filteredData.length} points</p>
            )}
          </>
        )}

        {/* Legend */}
        <div className="mt-4 border-t border-slate-800 pt-3 space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="text-[10px] text-blue-400">GLORYS {'<'} Argo</span>
            <div className="h-2 w-32 rounded-full bg-gradient-to-r from-blue-500 via-slate-700 to-red-500" />
            <span className="text-[10px] text-red-400">GLORYS {'>'} Argo</span>
          </div>
          <p className="text-center text-[10px] text-slate-600">
            Difference = GLORYS12V1 − Argo Delayed Mode | {filteredData.length} observation points
          </p>
        </div>
      </div>
    </div>
  );
}
