import React, { useRef, useState } from 'react';
import { 
  Layers, 
  SplitSquareVertical, 
  LineChart, 
  GitCommit, 
  Download, 
  FileCheck,
  BookmarkPlus,
  Plus
} from 'lucide-react';
import { useOceanStore } from '@/state/oceanStore';
import { useResearchVisualization3D, type Research3DPoint } from '@/integration';
import { DepthInspectorScene, type InspectorViewControls } from '@/components/visualization/research3d/DepthInspectorScene';
import { exportProfileCSV, exportComparisonCSV } from '@/utils/export';
import { LatestAvailableDataMode } from '@/components/workspace/LatestAvailableDataMode';
import { useLatestDataStream } from '@/hooks/useLatestDataStream';

export const ResearchWorkstation: React.FC = () => {
  const viewControlsRef = useRef<InspectorViewControls | null>(null);
  const {
    selectedLocation,
    selectedObservationId,
    selectedVariable,
    setSelectedVariable,
    selectedDate,
    selectedTime,
    selectedDepth,
    setSelectedDepth,
    verticalExaggeration,
    setVerticalExaggeration,
    colorScale,
    activeLayers,
    selectResearchObservation,
    researchDataMode,
  } = useOceanStore();

  const [activeProperty, setActiveProperty] = useState<'temperature' | 'salinity'>(
    selectedVariable === 'salinity' ? 'salinity' : 'temperature'
  );

  const [notes, setNotes] = useState<string>(
    `CRUISE RESEARCH LOG — Bay of Bengal Collocation (Jan 2024)
------------------------------------------------------------
- GLORYS12V1 × Argo Delayed Mode collocation comparison in the 0–500 dbar validated water column.
- Temperature structure reveals systematic positive bias (+0.25°C to +0.70°C) concentrated near the thermocline (50–200 dbar).
- Salinity indicates slight negative bias (−0.037 PSU) in the surface mixed layer.
- Difference convention: GLORYS − Argo (positive indicates model is higher than observation).`
  );

  const {
    points,
    selectedProfilePoints,
    selectedMeasurement,
    stats,
    unit,
    loading,
    error,
  } = useResearchVisualization3D({
    latitude: selectedLocation?.latitude ?? null,
    longitude: selectedLocation?.longitude ?? null,
    variable: activeProperty,
    date: selectedDate,
    time: selectedTime,
    selectedObservationId: researchDataMode === 'benchmark' && selectedObservationId?.startsWith('argo_') ? selectedObservationId : null,
    selectedDepth,
  });

  const latestStream = useLatestDataStream();
  const latestProfile = React.useMemo(() => latestStream.observations.find((profile) =>
    selectedObservationId === `latest_argo_${profile.platform_id}_${profile.cycle_number ?? profile.profile_id}`
  ) ?? latestStream.observations[0] ?? null, [latestStream.observations, selectedObservationId]);
  const latestProfilePoints = React.useMemo<Research3DPoint[]>(() => latestProfile?.levels.map((level) => ({
    latitude: latestProfile.latitude, longitude: latestProfile.longitude, pressure: level.pressure,
    argoValue: activeProperty === 'temperature' ? level.temperature : level.salinity,
    // There is no operational model value. NaN is a deliberate unavailable
    // sentinel; no GLORYS/difference geometry is rendered in Latest mode.
    glorysValue: Number.NaN, difference: Number.NaN, timestamp: latestProfile.observation_time,
    platformNumber: latestProfile.platform_id, cycleNumber: String(latestProfile.cycle_number ?? ''),
  })) ?? [], [activeProperty, latestProfile]);
  const latestScenePoints = React.useMemo<Research3DPoint[]>(() => latestStream.observations.flatMap((profile) => profile.levels.map((level) => ({
    latitude: profile.latitude, longitude: profile.longitude, pressure: level.pressure,
    argoValue: activeProperty === 'temperature' ? level.temperature : level.salinity,
    glorysValue: Number.NaN, difference: Number.NaN, timestamp: profile.observation_time,
    platformNumber: profile.platform_id, cycleNumber: String(profile.cycle_number ?? ''),
  }))), [activeProperty, latestStream.observations]);
  const displayedPoints = researchDataMode === 'latest' ? latestProfilePoints : points;
  const displayedProfilePoints = researchDataMode === 'latest' ? latestProfilePoints : selectedProfilePoints;
  const sceneProfilePoints = researchDataMode === 'latest' ? latestScenePoints : displayedProfilePoints;
  const displayedMeasurement = researchDataMode === 'latest'
    ? displayedProfilePoints.reduce<Research3DPoint | null>((closest, point) => !closest || Math.abs(point.pressure - selectedDepth) < Math.abs(closest.pressure - selectedDepth) ? point : closest, null)
    : selectedMeasurement;

  const propertyUnits = {
    temperature: '°C (ITS-90)',
    salinity: 'PSU (PSS-78)',
  };

  const handlePropertyChange = (prop: 'temperature' | 'salinity') => {
    setActiveProperty(prop);
    setSelectedVariable(prop);
  };

  // Group points by profile
  const profileGroups = React.useMemo(() => {
    const map = new Map<string, Research3DPoint[]>();
    for (const pt of displayedPoints) {
      const key = `argo_${pt.platformNumber}_${Math.trunc(parseFloat(pt.cycleNumber))}`;
      const existing = map.get(key) || [];
      existing.push(pt);
      map.set(key, existing);
    }
    return map;
  }, [displayedPoints]);

  const benchmarkProfiles = Array.from(profileGroups.entries()).map(([id, pts]) => ({
    id,
    platform: pts[0]?.platformNumber || 'Unknown',
    cycle: pts[0]?.cycleNumber ? Math.trunc(parseFloat(pts[0].cycleNumber)) : 0,
    lat: pts[0]?.latitude || 0,
    lon: pts[0]?.longitude || 0,
    count: pts.length,
  }));
  const uniqueProfiles = researchDataMode === 'latest'
    ? latestStream.observations.map((profile) => ({ id: `latest_argo_${profile.platform_id}_${profile.cycle_number ?? profile.profile_id}`, platform: profile.platform_id, cycle: profile.cycle_number ?? 0, lat: profile.latitude, lon: profile.longitude, count: profile.levels.length, observedAt: profile.observation_time }))
    : benchmarkProfiles;

  return (
    <div className="flex-1 bg-[#060a12] text-slate-200 flex flex-col overflow-hidden select-none font-sans">
      {/* Top Command Bar */}
      <div className="h-12 bg-[#09101c] border-b border-slate-800 px-4 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-teal-400">
            <Layers className="w-4 h-4" />
            <span className="font-bold tracking-wider text-slate-100">RESEARCH WORKSTATION</span>
            <span className="text-[10px] text-slate-500">[RWS-02]</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">ACTIVE PROFILE:</span>
            <span className="text-cyan-300 font-bold font-mono">
              {selectedObservationId ? selectedObservationId.replace('argo_', 'ARGO ').toUpperCase() : 'NO PROFILE SELECTED'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Property selector */}
          <div className="flex items-center bg-slate-900 rounded p-0.5 border border-slate-800">
            {(['temperature', 'salinity'] as const).map(prop => (
              <button
                key={prop}
                id={`btn-prop-${prop}`}
                onClick={() => handlePropertyChange(prop)}
                className={`px-3 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                  activeProperty === prop
                    ? 'bg-teal-950 text-teal-300 font-bold border border-teal-800/60'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {prop === 'temperature' ? 'Potential Temp (θ)' : 'Practical Salinity (S)'}
              </button>
            ))}
          </div>

          <button 
            onClick={() => {
              if (displayedMeasurement && researchDataMode === 'benchmark') {
                exportComparisonCSV(displayedMeasurement, activeProperty, unit);
              } else if (displayedProfilePoints.length > 0) {
                exportProfileCSV(displayedProfilePoints, activeProperty, unit);
              }
            }}
            disabled={displayedProfilePoints.length === 0}
            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-700 rounded flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-teal-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <LatestAvailableDataMode />

      {/* Main Multi-Panel Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2 p-2.5 overflow-y-auto">
        {/* Left Column: 3D Inverted Pyramid Inspector & Cast Selector (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-2">
          {/* Panel A: 3D Inverted Pyramid Inspector */}
          <div className="flex-1 bg-[#09101d] border border-slate-800 rounded-lg p-3 flex flex-col min-h-[420px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono">
              <div className="flex items-center space-x-2">
                <SplitSquareVertical className="w-3.5 h-3.5 text-teal-400" />
                <span className="font-semibold text-slate-200 uppercase">
                  3D Water-Column Inspector: Inverted Pyramid (0–500m)
                </span>
              </div>
              <span className="text-[11px] text-cyan-400 font-mono">
                Field: {activeProperty.toUpperCase()} [{propertyUnits[activeProperty]}]
              </span>
            </div>

            {/* Inverted Pyramid Scene Canvas */}
            <div className="flex-1 relative rounded border border-slate-800/80 bg-[#050912] overflow-hidden mt-2 min-h-[300px]">
              <DepthInspectorScene
                className="h-full w-full"
                profilePoints={sceneProfilePoints}
                unit={unit}
                variable={activeProperty}
                selectedDepth={selectedDepth}
                verticalExaggeration={verticalExaggeration}
                colorScale={colorScale}
                renderMode="variables"
                layers={{
                  argo: {
                    visible: activeLayers.find((l) => l.id === 'observations')?.enabled ?? true,
                    opacity: activeLayers.find((l) => l.id === 'observations')?.opacity ?? 1,
                  },
                  glorys: {
                    visible: researchDataMode === 'benchmark' && (activeLayers.find((l) => l.id === 'models')?.enabled ?? true),
                    opacity: activeLayers.find((l) => l.id === 'models')?.opacity ?? 1,
                  },
                  discrepancies: {
                    visible: researchDataMode === 'benchmark' && (activeLayers.find((l) => l.id === 'discrepancies')?.enabled ?? true),
                    opacity: activeLayers.find((l) => l.id === 'discrepancies')?.opacity ?? 0.85,
                  },
                  depthSlice: {
                    visible: activeLayers.find((l) => l.id === 'depthSlice')?.enabled ?? true,
                    opacity: activeLayers.find((l) => l.id === 'depthSlice')?.opacity ?? 1,
                  },
                }}
                viewControlsRef={viewControlsRef}
              />

              <div className="absolute right-3 top-3 z-10 flex gap-1.5" aria-label="3D view controls">
                <button type="button" onClick={() => viewControlsRef.current?.zoomIn()} className="rounded border border-slate-700 bg-[#09101d]/95 px-2 py-1 text-[10px] text-slate-200 hover:border-cyan-500">
                  Zoom In
                </button>
                <button type="button" onClick={() => viewControlsRef.current?.zoomOut()} className="rounded border border-slate-700 bg-[#09101d]/95 px-2 py-1 text-[10px] text-slate-200 hover:border-cyan-500">
                  Zoom Out
                </button>
                <button type="button" onClick={() => viewControlsRef.current?.resetView()} className="rounded border border-slate-700 bg-[#09101d]/95 px-2 py-1 text-[10px] text-slate-200 hover:border-cyan-500">
                  Reset View
                </button>
              </div>

              {loading && (
                <div className="absolute inset-0 bg-[#050912]/80 flex items-center justify-center font-mono text-xs text-cyan-400">
                  Loading collocated observations...
                </div>
              )}

              {error && (
                <div className="absolute inset-0 bg-[#050912]/80 flex items-center justify-center font-mono text-xs text-rose-400">
                  {error}
                </div>
              )}

              {researchDataMode === 'benchmark' && !selectedObservationId && !loading && (
                <div className="absolute inset-0 bg-[#050912]/70 flex items-center justify-center font-mono text-xs text-slate-400 p-6 text-center">
                  Select a comparative hydrographic cast below to inspect its water column in 3D.
                </div>
              )}
            </div>

            {/* Depth and Exaggeration Controls */}
            <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-slate-400 gap-4">
              <div className="flex items-center space-x-2 flex-1">
                <span className="text-slate-500">DEPTH:</span>
                <input
                  type="range"
                  min="0"
                  max="500"
                  value={selectedDepth}
                  onChange={(e) => setSelectedDepth(parseInt(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-teal-500"
                />
                <span className="text-cyan-400 font-bold tabular-nums w-14 text-right">{selectedDepth} dbar</span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-slate-500">EXAGGERATION:</span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={verticalExaggeration}
                  onChange={(e) => setVerticalExaggeration(parseFloat(e.target.value))}
                  className="w-20 h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-teal-500"
                />
                <span className="text-slate-300 tabular-nums">{verticalExaggeration.toFixed(1)}×</span>
              </div>
            </div>
          </div>

          {/* Panel B: Comparative Hydrographic Casts */}
          <div className="bg-[#09101d] border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2 text-xs font-mono">
              <div className="flex items-center space-x-2">
                <GitCommit className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold text-slate-200">{researchDataMode === 'latest' ? 'Latest Argo Profiles (Bay of Bengal)' : 'Comparative Hydrographic Casts (Bay of Bengal)'}</span>
              </div>
              <span className="text-[10px] text-slate-500">{uniqueProfiles.length} profiles available</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              {uniqueProfiles.slice(0, 8).map((prof) => {
                const isSelected = selectedObservationId === prof.id;
                return (
                  <button
                    key={prof.id}
                    id={`btn-select-cast-${prof.id}`}
                    onClick={() => selectResearchObservation({
                      id: prof.id,
                      location: { latitude: prof.lat, longitude: prof.lon },
                      date: researchDataMode === 'latest' && 'observedAt' in prof ? String(prof.observedAt) : selectedDate,
                    })}
                    className={`p-2 rounded border text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-teal-950/70 border-teal-600 text-teal-200'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">ARGO {prof.platform}</span>
                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-teal-400' : 'bg-slate-600'}`} />
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">Cycle #{prof.cycle}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{prof.count} levels</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Profile Comparison & Research Cruise Log (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-2">
          {/* Panel C: Vertical Profile Comparison Plot (No density isopycnals) */}
          <div className="bg-[#09101d] border border-slate-800 rounded-lg p-3 flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono">
              <div className="flex items-center space-x-2">
                <LineChart className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold text-slate-200 uppercase">{researchDataMode === 'latest' ? 'Vertical Profile: Latest Argo Measurement' : 'Vertical Profile: Argo vs GLORYS'}</span>
              </div>
              {researchDataMode === 'benchmark' && <span className="text-[10px] text-teal-400 bg-teal-950 px-1.5 py-0.5 rounded border border-teal-800/60">
                GLORYS − Argo
              </span>}
            </div>

            {/* Profile Plot SVG */}
            <div className="pt-2 flex-1 flex items-center justify-center">
              <ProfileSvgChart
                points={displayedProfilePoints}
                variable={activeProperty}
                unit={unit}
                selectedMeasurement={displayedMeasurement}
                latestOnly={researchDataMode === 'latest'}
              />
            </div>

            {/* Evidence Readings at selected depth */}
            {displayedMeasurement && researchDataMode === 'benchmark' && (
              <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">
                  Argo: <strong className="text-cyan-400">{displayedMeasurement.argoValue.toFixed(2)}</strong> {unit}
                </span>
                <span className="text-slate-400">
                  GLORYS: <strong className="text-purple-400">{displayedMeasurement.glorysValue.toFixed(2)}</strong> {unit}
                </span>
                <span className="text-slate-400">
                  Diff: <strong className={displayedMeasurement.difference >= 0 ? 'text-amber-400' : 'text-blue-400'}>
                    {displayedMeasurement.difference > 0 ? '+' : ''}{displayedMeasurement.difference.toFixed(2)}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Panel D: Scientific Research Cruise Log */}
          <div className="flex-1 bg-[#09101d] border border-slate-800 rounded-lg p-3 flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono">
              <div className="flex items-center space-x-2">
                <BookmarkPlus className="w-3.5 h-3.5 text-teal-400" />
                <span className="font-semibold text-slate-200 uppercase">Scientific Research Log</span>
              </div>
              <span className="text-[10px] text-emerald-400 flex items-center space-x-1">
                <FileCheck className="w-3 h-3" />
                <span>AUTO-SAVED</span>
              </span>
            </div>

            <textarea
              id="textarea-research-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={8}
              className="mt-2 flex-1 w-full bg-[#050912] border border-slate-800 rounded p-2.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-teal-500 transition-colors resize-none leading-relaxed"
            />

            <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>WMO / IODE Standard Cruise Format</span>
              <button 
                onClick={() => setNotes(notes + `\n[${new Date().toISOString()}] Annotation added.`)}
                className="text-teal-400 hover:text-teal-300 flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Timestamp Note</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function ProfileSvgChart({
  points,
  variable,
  unit,
  selectedMeasurement,
  latestOnly = false,
}: {
  points: Research3DPoint[];
  variable: string;
  unit: string;
  selectedMeasurement: Research3DPoint | null;
  latestOnly?: boolean;
}) {
  if (points.length === 0) {
    return (
      <div className="h-56 w-full flex items-center justify-center font-mono text-xs text-slate-500 bg-[#050912] rounded border border-slate-800">
        No profile points selected.
      </div>
    );
  }

  const depthMap = new Map<number, { argo: number[]; glorys: number[] }>();
  for (const p of points) {
    const depth = Math.round(p.pressure);
    if (!depthMap.has(depth)) depthMap.set(depth, { argo: [], glorys: [] });
    depthMap.get(depth)!.argo.push(p.argoValue);
    depthMap.get(depth)!.glorys.push(p.glorysValue);
  }

  const profile = Array.from(depthMap.entries())
    .map(([depth, vals]) => ({
      depth,
      argo: vals.argo.reduce((a, b) => a + b, 0) / vals.argo.length,
      glorys: vals.glorys.reduce((a, b) => a + b, 0) / vals.glorys.length,
    }))
    .sort((a, b) => a.depth - b.depth);

  const allVals = profile.flatMap(p => latestOnly ? [p.argo] : [p.argo, p.glorys]).filter(Number.isFinite);
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const maxDepth = Math.max(500, Math.max(...profile.map(p => p.depth)));
  const valRange = maxVal - minVal || 1;

  const chartW = 340;
  const chartH = 220;
  const padL = 40;
  const padR = 20;
  const padT = 15;
  const padB = 30;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const toX = (val: number) => padL + ((val - minVal) / valRange) * plotW;
  const toY = (depth: number) => padT + (depth / maxDepth) * plotH;

  const argoPath = profile.map(p => `${toX(p.argo).toFixed(1)},${toY(p.depth).toFixed(1)}`).join(' ');
  const glorysPath = profile.map(p => `${toX(p.glorys).toFixed(1)},${toY(p.depth).toFixed(1)}`).join(' ');

  return (
    <svg className="w-full h-56 bg-[#050912] rounded border border-slate-800/80" viewBox={`0 0 ${chartW} ${chartH}`}>
      {/* Depth Gridlines (Y) */}
      {[0, 100, 200, 300, 400, 500].map(d => {
        const y = toY(d);
        return (
          <g key={d}>
            <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
            <text x="8" y={y + 3} fill="#64748b" fontSize="7" fontFamily="monospace">{d}m</text>
          </g>
        );
      })}

      {/* Value Gridlines (X) */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const val = minVal + f * valRange;
        const x = padL + f * plotW;
        return (
          <g key={i}>
            <line x1={x} y1={padT} x2={x} y2={chartH - padB} stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
            <text x={x} y={chartH - padB + 12} fill="#64748b" fontSize="7" fontFamily="monospace" textAnchor="middle">
              {val.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* Argo trace (Cyan dashed) */}
      <polyline points={argoPath} fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="4 2" />

      {/* GLORYS trace (Purple solid) */}
      {!latestOnly && <polyline points={glorysPath} fill="none" stroke="#a78bfa" strokeWidth="2" />}

      {/* Active Measurement point indicator */}
      {selectedMeasurement && (
        <g>
          <line
            x1={padL}
            y1={toY(selectedMeasurement.pressure)}
            x2={chartW - padR}
            y2={toY(selectedMeasurement.pressure)}
            stroke="#06b6d4"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <circle cx={toX(selectedMeasurement.argoValue)} cy={toY(selectedMeasurement.pressure)} r="3.5" fill="#22d3ee" stroke="#ffffff" strokeWidth="1" />
          {!latestOnly && <circle cx={toX(selectedMeasurement.glorysValue)} cy={toY(selectedMeasurement.pressure)} r="3.5" fill="#a78bfa" stroke="#ffffff" strokeWidth="1" />}
        </g>
      )}

      {/* Legend */}
      <line x1={padL + 5} y1={chartH - 8} x2={padL + 25} y2={chartH - 8} stroke="#22d3ee" strokeWidth="2" strokeDasharray="4 2" />
      <text x={padL + 28} y={chartH - 5} fill="#22d3ee" fontSize="8" fontFamily="monospace">Argo</text>
      <line x1={padL + 75} y1={chartH - 8} x2={padL + 95} y2={chartH - 8} stroke="#a78bfa" strokeWidth="2" />
      <text x={padL + 98} y={chartH - 5} fill="#a78bfa" fontSize="8" fontFamily="monospace">GLORYS</text>
      <text x={chartW - padR} y={chartH - 5} fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="end">
        {variable} ({unit})
      </text>
    </svg>
  );
}
