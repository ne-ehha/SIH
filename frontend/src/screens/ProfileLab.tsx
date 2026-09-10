import React, { useState, useMemo } from 'react';
import { 
  Terminal, 
  Sliders, 
  Download, 
  CheckCircle, 
  Table,
  LineChart
} from 'lucide-react';
import { useOceanStore } from '@/state/oceanStore';
import { useResearchVisualization3D, type Research3DPoint } from '@/integration';
import { exportProfileCSV } from '@/utils/export';

export const ProfileLab: React.FC = () => {
  const {
    selectedLocation,
    selectedObservationId,
    selectedDate,
    selectedTime,
    selectedDepth,
    setSelectedDepth,
    selectResearchObservation,
  } = useOceanStore();

  const [activeDepthCursor, setActiveDepthCursor] = useState<number>(selectedDepth);
  const [viewMode, setViewMode] = useState<'plots' | 'table'>('plots');

  // Load collocated Temperature profile
  const tempQuery = useResearchVisualization3D({
    latitude: selectedLocation?.latitude ?? null,
    longitude: selectedLocation?.longitude ?? null,
    variable: 'temperature',
    date: selectedDate,
    time: selectedTime,
    selectedObservationId,
    selectedDepth: activeDepthCursor,
  });

  // Load collocated Salinity profile
  const salQuery = useResearchVisualization3D({
    latitude: selectedLocation?.latitude ?? null,
    longitude: selectedLocation?.longitude ?? null,
    variable: 'salinity',
    date: selectedDate,
    time: selectedTime,
    selectedObservationId,
    selectedDepth: activeDepthCursor,
  });

  const tempPoints = tempQuery.selectedProfilePoints;
  const salPoints = salQuery.selectedProfilePoints;

  // Group all available observations for selection
  const allProfiles = useMemo(() => {
    const map = new Map<string, Research3DPoint>();
    for (const p of tempQuery.points) {
      const key = `argo_${p.platformNumber}_${Math.trunc(parseFloat(p.cycleNumber))}`;
      if (!map.has(key)) map.set(key, p);
    }
    return Array.from(map.values()).map(p => ({
      id: `argo_${p.platformNumber}_${Math.trunc(parseFloat(p.cycleNumber))}`,
      platform: p.platformNumber,
      cycle: Math.trunc(parseFloat(p.cycleNumber)),
      lat: p.latitude,
      lon: p.longitude,
    }));
  }, [tempQuery.points]);

  // Merge temp and salinity by depth
  interface MergedLevel {
    depth: number;
    argoTemp: number;
    glorysTemp: number;
    tempDiff: number;
    argoSal: number;
    glorysSal: number;
    salDiff: number;
  }

  const mergedData: MergedLevel[] = useMemo(() => {
    const depths = new Set<number>();
    tempPoints.forEach(p => depths.add(Math.round(p.pressure)));
    salPoints.forEach(p => depths.add(Math.round(p.pressure)));

    const sortedDepths = Array.from(depths).sort((a, b) => a - b);
    return sortedDepths.map(d => {
      const t = tempPoints.find(p => Math.abs(p.pressure - d) < 1.0);
      const s = salPoints.find(p => Math.abs(p.pressure - d) < 1.0);
      return {
        depth: d,
        argoTemp: t ? t.argoValue : 0,
        glorysTemp: t ? t.glorysValue : 0,
        tempDiff: t ? t.difference : 0,
        argoSal: s ? s.argoValue : 0,
        glorysSal: s ? s.glorysValue : 0,
        salDiff: s ? s.difference : 0,
      };
    }).filter(row => row.argoTemp > 0 || row.argoSal > 0);
  }, [tempPoints, salPoints]);

  const nearestRow = mergedData.reduce((prev, curr) => 
    Math.abs(curr.depth - activeDepthCursor) < Math.abs(prev.depth - activeDepthCursor) ? curr : prev,
    mergedData[0] || { depth: 0, argoTemp: 0, glorysTemp: 0, tempDiff: 0, argoSal: 0, glorysSal: 0, salDiff: 0 }
  );

  return (
    <div className="flex-1 bg-[#060a12] text-slate-200 flex flex-col overflow-hidden select-none font-sans">
      {/* Top Header */}
      <div className="h-12 bg-[#09101c] border-b border-slate-800 px-4 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-cyan-400">
            <Terminal className="w-4 h-4" />
            <span className="font-bold tracking-wider text-slate-100">PROFILE LAB</span>
            <span className="text-[10px] text-slate-500">[PLB-03]</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">ARGO CAST:</span>
            <select
              id="select-profile-station"
              value={selectedObservationId || (allProfiles[0]?.id ?? '')}
              onChange={(e) => {
                const prof = allProfiles.find(p => p.id === e.target.value);
                if (prof) {
                  selectResearchObservation({
                    id: prof.id,
                    location: { latitude: prof.lat, longitude: prof.lon },
                    date: selectedDate,
                  });
                }
              }}
              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-0.5 text-cyan-300 font-mono focus:outline-none cursor-pointer"
            >
              {allProfiles.map(p => (
                <option key={p.id} value={p.id}>
                  ARGO {p.platform} · Cycle #{p.cycle} ({p.lat.toFixed(2)}°N, {p.lon.toFixed(2)}°E)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Toggle controls */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 bg-slate-900 rounded p-0.5 border border-slate-800">
            <button
              id="btn-view-plots"
              onClick={() => setViewMode('plots')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                viewMode === 'plots' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60' : 'text-slate-400'
              }`}
            >
              4-Channel Plots
            </button>
            <button
              id="btn-view-table"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60' : 'text-slate-400'
              }`}
            >
              Collocation Table
            </button>
          </div>

          <button 
            onClick={() => {
              if (tempPoints.length > 0) {
                exportProfileCSV(tempPoints, 'temperature', '°C');
              }
            }}
            disabled={tempPoints.length === 0}
            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-700 rounded flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Synchronized Cursor Scrubbing Bar */}
      <div className="h-10 bg-[#080e18] border-b border-slate-800 px-4 flex items-center justify-between font-mono text-xs text-slate-300">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500">CURSOR DEPTH:</span>
            <input
              id="input-depth-cursor-slider"
              type="range"
              min="0"
              max="500"
              value={activeDepthCursor}
              onChange={(e) => {
                const d = parseInt(e.target.value, 10);
                setActiveDepthCursor(d);
                setSelectedDepth(d);
              }}
              className="w-40 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-cyan-500"
            />
            <span className="text-cyan-400 font-bold tabular-nums">{activeDepthCursor} dbar</span>
          </div>

          {nearestRow && (
            <div className="hidden md:flex items-center space-x-3 text-[11px] text-slate-400">
              <span>Argo T: <strong className="text-rose-400 font-mono">{nearestRow.argoTemp.toFixed(2)} °C</strong></span>
              <span>GLORYS T: <strong className="text-purple-400 font-mono">{nearestRow.glorysTemp.toFixed(2)} °C</strong></span>
              <span>Argo S: <strong className="text-teal-400 font-mono">{nearestRow.argoSal.toFixed(2)} PSU</strong></span>
              <span>GLORYS S: <strong className="text-indigo-400 font-mono">{nearestRow.glorysSal.toFixed(2)} PSU</strong></span>
            </div>
          )}
        </div>

        {/* Scientific Oceanographic Boundaries */}
        <div className="flex items-center space-x-2 text-[10px]">
          <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800/60">
            WINDOW: 0–500 dbar
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60">
            CONVENTION: GLORYS − Argo
          </span>
          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
            QC=1 (DELAYED MODE)
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'plots' ? (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2 p-3 overflow-y-auto">
          {/* Channel 1: Potential Temperature (°C) */}
          <div className="bg-[#09101d] border border-slate-800 rounded-lg p-3 flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono">
              <span className="font-bold text-rose-400">CH 1: POTENTIAL TEMP (θ)</span>
              <span className="text-[10px] text-slate-400">0 – 30 °C</span>
            </div>

            <div className="flex-1 relative flex items-center justify-center pt-2">
              <ChannelSvg
                points={mergedData.map(d => ({ depth: d.depth, val1: d.argoTemp, val2: d.glorysTemp }))}
                color1="#22d3ee"
                color2="#a78bfa"
                minVal={10}
                maxVal={30}
                cursorDepth={activeDepthCursor}
                unit="°C"
              />
            </div>
            <div className="pt-2 text-[10px] font-mono text-slate-400 flex justify-between">
              <span className="text-cyan-400">Argo: {nearestRow.argoTemp.toFixed(2)}°C</span>
              <span className="text-purple-400">GLORYS: {nearestRow.glorysTemp.toFixed(2)}°C</span>
            </div>
          </div>

          {/* Channel 2: Practical Salinity (PSU) */}
          <div className="bg-[#09101d] border border-slate-800 rounded-lg p-3 flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono">
              <span className="font-bold text-teal-400">CH 2: PRACTICAL SALINITY (S)</span>
              <span className="text-[10px] text-slate-400">32 – 36 PSU</span>
            </div>

            <div className="flex-1 relative flex items-center justify-center pt-2">
              <ChannelSvg
                points={mergedData.map(d => ({ depth: d.depth, val1: d.argoSal, val2: d.glorysSal }))}
                color1="#14b8a6"
                color2="#a78bfa"
                minVal={32}
                maxVal={36}
                cursorDepth={activeDepthCursor}
                unit="PSU"
              />
            </div>
            <div className="pt-2 text-[10px] font-mono text-slate-400 flex justify-between">
              <span className="text-teal-400">Argo: {nearestRow.argoSal.toFixed(2)} PSU</span>
              <span className="text-purple-400">GLORYS: {nearestRow.glorysSal.toFixed(2)} PSU</span>
            </div>
          </div>

          {/* Channel 3: Temperature Difference (GLORYS − Argo) */}
          <div className="bg-[#09101d] border border-slate-800 rounded-lg p-3 flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono">
              <span className="font-bold text-amber-400">CH 3: TEMP DIFFERENCE (ΔT)</span>
              <span className="text-[10px] text-slate-400">−1.5 to +1.5 °C</span>
            </div>

            <div className="flex-1 relative flex items-center justify-center pt-2">
              <DiffSvg
                points={mergedData.map(d => ({ depth: d.depth, diff: d.tempDiff }))}
                minDiff={-1.5}
                maxDiff={1.5}
                cursorDepth={activeDepthCursor}
                unit="°C"
              />
            </div>
            <div className="pt-2 text-[10px] font-mono text-slate-400 flex justify-between">
              <span>GLORYS − Argo:</span>
              <span className={nearestRow.tempDiff >= 0 ? 'text-amber-400 font-bold' : 'text-blue-400 font-bold'}>
                {nearestRow.tempDiff > 0 ? '+' : ''}{nearestRow.tempDiff.toFixed(2)} °C
              </span>
            </div>
          </div>

          {/* Channel 4: Salinity Difference (GLORYS − Argo) */}
          <div className="bg-[#09101d] border border-slate-800 rounded-lg p-3 flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono">
              <span className="font-bold text-sky-400">CH 4: SALINITY DIFFERENCE (ΔS)</span>
              <span className="text-[10px] text-slate-400">−0.8 to +0.8 PSU</span>
            </div>

            <div className="flex-1 relative flex items-center justify-center pt-2">
              <DiffSvg
                points={mergedData.map(d => ({ depth: d.depth, diff: d.salDiff }))}
                minDiff={-0.8}
                maxDiff={0.8}
                cursorDepth={activeDepthCursor}
                unit="PSU"
              />
            </div>
            <div className="pt-2 text-[10px] font-mono text-slate-400 flex justify-between">
              <span>GLORYS − Argo:</span>
              <span className={nearestRow.salDiff >= 0 ? 'text-amber-400 font-bold' : 'text-blue-400 font-bold'}>
                {nearestRow.salDiff > 0 ? '+' : ''}{nearestRow.salDiff.toFixed(2)} PSU
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Raw Tabular Collocation View */
        <div className="flex-1 p-3 overflow-y-auto">
          <div className="bg-[#09101d] border border-slate-800 rounded-lg p-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs font-mono">
              <span className="font-bold text-slate-200">
                COLLOCATED PROFILE OBSERVATIONS (0–500 dbar)
              </span>
              <span className="text-emerald-400">QC CODE: 1 (DELAYED MODE VALIDATED)</span>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left font-mono text-xs text-slate-300">
                <thead className="bg-[#050912] text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Depth (dbar)</th>
                    <th className="py-2 px-3 text-cyan-400">Argo Temp (°C)</th>
                    <th className="py-2 px-3 text-purple-400">GLORYS Temp (°C)</th>
                    <th className="py-2 px-3">Temp Δ (°C)</th>
                    <th className="py-2 px-3 text-teal-400">Argo Sal (PSU)</th>
                    <th className="py-2 px-3 text-purple-400">GLORYS Sal (PSU)</th>
                    <th className="py-2 px-3">Sal Δ (PSU)</th>
                    <th className="py-2 px-3 text-right">QC Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {mergedData.map((m) => (
                    <tr 
                      key={m.depth} 
                      className={`hover:bg-slate-850/60 transition-colors ${
                        m.depth === nearestRow.depth ? 'bg-cyan-950/40 text-cyan-200 font-bold' : ''
                      }`}
                    >
                      <td className="py-2 px-3 tabular-nums">{m.depth}</td>
                      <td className="py-2 px-3 tabular-nums text-cyan-300">{m.argoTemp.toFixed(3)}</td>
                      <td className="py-2 px-3 tabular-nums text-purple-300">{m.glorysTemp.toFixed(3)}</td>
                      <td className={`py-2 px-3 tabular-nums ${m.tempDiff >= 0 ? 'text-amber-400' : 'text-blue-400'}`}>
                        {m.tempDiff > 0 ? '+' : ''}{m.tempDiff.toFixed(3)}
                      </td>
                      <td className="py-2 px-3 tabular-nums text-teal-300">{m.argoSal.toFixed(3)}</td>
                      <td className="py-2 px-3 tabular-nums text-purple-300">{m.glorysSal.toFixed(3)}</td>
                      <td className={`py-2 px-3 tabular-nums ${m.salDiff >= 0 ? 'text-amber-400' : 'text-blue-400'}`}>
                        {m.salDiff > 0 ? '+' : ''}{m.salDiff.toFixed(3)}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-300 rounded border border-emerald-800/60 text-[10px]">
                          QC=1
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function ChannelSvg({
  points,
  color1,
  color2,
  minVal,
  maxVal,
  cursorDepth,
  unit,
}: {
  points: Array<{ depth: number; val1: number; val2: number }>;
  color1: string;
  color2: string;
  minVal: number;
  maxVal: number;
  cursorDepth: number;
  unit: string;
}) {
  const chartW = 160;
  const chartH = 380;
  const padL = 25;
  const padR = 10;
  const padT = 15;
  const padB = 25;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const maxDepth = 500;
  const valRange = maxVal - minVal || 1;

  const toX = (v: number) => padL + ((v - minVal) / valRange) * plotW;
  const toY = (d: number) => padT + (d / maxDepth) * plotH;

  const path1 = points.map(p => `${toX(p.val1).toFixed(1)},${toY(p.depth).toFixed(1)}`).join(' ');
  const path2 = points.map(p => `${toX(p.val2).toFixed(1)},${toY(p.depth).toFixed(1)}`).join(' ');

  return (
    <svg className="w-full h-full min-h-[380px] bg-[#050912] rounded border border-slate-800/60" viewBox={`0 0 ${chartW} ${chartH}`}>
      {/* Depth Grid Lines */}
      {[0, 100, 200, 300, 400, 500].map(d => {
        const y = toY(d);
        return (
          <g key={d}>
            <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
            <text x="3" y={y + 3} fill="#64748b" fontSize="7" fontFamily="monospace">{d}</text>
          </g>
        );
      })}

      {/* Path 1: Argo (dashed) */}
      <polyline points={path1} fill="none" stroke={color1} strokeWidth="2" strokeDasharray="4 2" />

      {/* Path 2: GLORYS (solid) */}
      <polyline points={path2} fill="none" stroke={color2} strokeWidth="2" />

      {/* Cursor horizontal line */}
      <line x1={padL} y1={toY(cursorDepth)} x2={chartW - padR} y2={toY(cursorDepth)} stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 1" />
    </svg>
  );
}

function DiffSvg({
  points,
  minDiff,
  maxDiff,
  cursorDepth,
  unit,
}: {
  points: Array<{ depth: number; diff: number }>;
  minDiff: number;
  maxDiff: number;
  cursorDepth: number;
  unit: string;
}) {
  const chartW = 160;
  const chartH = 380;
  const padL = 25;
  const padR = 10;
  const padT = 15;
  const padB = 25;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const maxDepth = 500;
  const diffRange = maxDiff - minDiff || 1;

  const toX = (v: number) => padL + ((v - minDiff) / diffRange) * plotW;
  const toY = (d: number) => padT + (d / maxDepth) * plotH;

  const zeroX = toX(0);
  const path = points.map(p => `${toX(p.diff).toFixed(1)},${toY(p.depth).toFixed(1)}`).join(' ');

  return (
    <svg className="w-full h-full min-h-[380px] bg-[#050912] rounded border border-slate-800/60" viewBox={`0 0 ${chartW} ${chartH}`}>
      {/* Zero line */}
      <line x1={zeroX} y1={padT} x2={zeroX} y2={chartH - padB} stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />

      {/* Depth Grid Lines */}
      {[0, 100, 200, 300, 400, 500].map(d => {
        const y = toY(d);
        return (
          <g key={d}>
            <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
            <text x="3" y={y + 3} fill="#64748b" fontSize="7" fontFamily="monospace">{d}</text>
          </g>
        );
      })}

      {/* Diff Polyline */}
      <polyline points={path} fill="none" stroke="#f59e0b" strokeWidth="2" />

      {/* Cursor horizontal line */}
      <line x1={padL} y1={toY(cursorDepth)} x2={chartW - padR} y2={toY(cursorDepth)} stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 1" />
    </svg>
  );
}
