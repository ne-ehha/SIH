/**
 * Research3DView — GLORYS × Argo Research Visualization
 *
 * Displays real collocated observations as a 3D point cloud.
 * X = longitude, Y = depth (pressure), color = value or difference.
 *
 * This is NOT a complete 3D ocean model — it visualizes the actual
 * sparse, irregularly spaced GLORYS × Argo collocated observations.
 */

import { useOceanStore } from '@/state/oceanStore';
import { useResearchVisualization3D } from '@/integration';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import type { Research3DPoint } from '@/integration';

export function Research3DView() {
  const {
    selectedLocation,
    selectedVariable,
    selectedDate,
    selectedTime,
    isModelViewOpen,
    setIsModelViewOpen,
  } = useOceanStore();

  const {
    points,
    stats,
    unit,
    loading,
    error,
  } = useResearchVisualization3D({
    latitude: selectedLocation?.latitude ?? null,
    longitude: selectedLocation?.longitude ?? null,
    variable: selectedVariable,
    date: selectedDate,
    time: selectedTime,
  });

  if (!isModelViewOpen || !selectedLocation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 flex h-[90vh] w-full max-w-6xl flex-col rounded-2xl border border-slate-700/50 bg-[#0a0e1a] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Research 3D — GLORYS × Argo</h2>
            <p className="text-xs text-slate-500">
              {selectedLocation.latitude.toFixed(2)}° {selectedLocation.latitude >= 0 ? 'N' : 'S'},{' '}
              {selectedLocation.longitude.toFixed(2)}° {selectedLocation.longitude >= 0 ? 'E' : 'W'}
              {unit && <span className="ml-2 text-cyan-400">• {selectedVariable} ({unit})</span>}
              <span className="ml-2 text-purple-400">• {selectedDate}</span>
            </p>
            <p className="mt-0.5 text-[10px] text-slate-600">
              Real GLORYS12V1 × Argo Delayed Mode collocated observations — not a gridded model
            </p>
          </div>
          <button
            onClick={() => setIsModelViewOpen(false)}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar: stats + legend */}
          <div className="w-72 border-r border-slate-800 p-4 overflow-y-auto space-y-4">
            {stats && (
              <>
                <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Dataset Summary</h4>
                  <div className="space-y-1.5 text-[11px]">
                    <Row label="Total points" value={String(stats.totalPoints)} />
                    <Row label="Argo mean" value={`${stats.argoMean.toFixed(2)} ${unit}`} />
                    <Row label="GLORYS mean" value={`${stats.glorysMean.toFixed(2)} ${unit}`} />
                    <Row label="Mean difference" value={`${stats.meanDifference > 0 ? '+' : ''}${stats.meanDifference.toFixed(4)} ${unit}`} color={Math.abs(stats.meanDifference) < 0.5 ? 'text-green-400' : 'text-amber-400'} />
                    <Row label="RMS difference" value={`${stats.rmsDifference.toFixed(4)} ${unit}`} />
                    <Row label="Max |difference|" value={`${stats.maxDifference.toFixed(4)} ${unit}`} />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Coverage</h4>
                  <div className="space-y-1.5 text-[11px]">
                    <Row label="Depth range" value={`${stats.depthRange[0]}–${stats.depthRange[1]} dbar`} />
                    <Row label="Lat range" value={`${stats.spatialBounds.south}–${stats.spatialBounds.north}°N`} />
                    <Row label="Lon range" value={`${stats.spatialBounds.west}–${stats.spatialBounds.east}°E`} />
                  </div>
                </div>
              </>
            )}

            <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-3">
              <h4 className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Legend</h4>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  <span className="text-slate-400">Argo observation</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-purple-400" />
                  <span className="text-slate-400">GLORYS model</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="text-slate-400">Difference / error</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800/50 bg-slate-900/20 p-3">
              <p className="text-[10px] text-slate-500 italic">
                Source: GLORYS12V1 × Argo Delayed Mode collocation
              </p>
              <p className="text-[10px] text-slate-600 mt-1">
                {points.length} real observation points for {selectedDate}
              </p>
            </div>
          </div>

          {/* Main visualization */}
          <div className="flex-1 relative overflow-hidden">
            <div className="h-full w-full bg-gradient-to-b from-[#0d1b3e] to-[#0a0e1a] overflow-y-auto p-6">
              {loading && (
                <div className="flex h-full items-center justify-center">
                  <LoadingState message="Loading Research visualization data..." />
                </div>
              )}
              {error && !loading && (
                <div className="flex h-full items-center justify-center p-8">
                  <ErrorState message={error} />
                </div>
              )}
              {!loading && !error && points.length === 0 && (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-slate-500">No collocation observations for this date</p>
                </div>
              )}
              {!loading && !error && points.length > 0 && (
                <div className="space-y-8">
                  {/* Scatter plot: Longitude vs Depth */}
                  <ScatterPlot
                    points={points}
                    unit={unit}
                    variable={selectedVariable}
                    title="Longitude vs Depth"
                    xAxis="longitude"
                    yAxis="pressure"
                  />

                  {/* Scatter plot: Latitude vs Depth */}
                  <ScatterPlot
                    points={points}
                    unit={unit}
                    variable={selectedVariable}
                    title="Latitude vs Depth"
                    xAxis="latitude"
                    yAxis="pressure"
                  />

                  {/* Comparison chart: Argo vs GLORYS at each depth */}
                  <ComparisonChart points={points} unit={unit} variable={selectedVariable} />

                  {/* Observation table (first 20) */}
                  <ObservationTable points={points.slice(0, 20)} unit={unit} variable={selectedVariable} />
                  {points.length > 20 && (
                    <p className="text-[10px] text-slate-600 text-center">
                      Showing 20 of {points.length} observations
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium ${color || 'text-slate-300'}`}>{value}</span>
    </div>
  );
}

function ScatterPlot({
  points,
  unit,
  variable,
  title,
  xAxis,
  yAxis,
}: {
  points: Research3DPoint[];
  unit: string;
  variable: string;
  title: string;
  xAxis: 'longitude' | 'latitude';
  yAxis: 'pressure';
}) {
  const xValues = points.map((p) => p[xAxis]);
  const yValues = points.map((p) => p[yAxis]);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = 0; // depth starts at 0
  const yMax = Math.max(...yValues);

  const chartW = 500;
  const chartH = 250;
  const padL = 50;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const toX = (val: number) => padL + ((val - xMin) / (xMax - xMin || 1)) * plotW;
  const toY = (val: number) => padT + (val / (yMax || 1)) * plotH; // 0 at top, max at bottom

  // Color by argo value
  const argoVals = points.map((p) => p.argoValue);
  const minVal = Math.min(...argoVals);
  const maxVal = Math.max(...argoVals);
  const valRange = maxVal - minVal || 1;

  const getColor = (val: number) => {
    const normalized = (val - minVal) / valRange;
    const hue = (1 - normalized) * 240; // blue (cold) to red (warm)
    return `hsl(${hue}, 70%, 50%)`;
  };

  const xLabel = xAxis === 'longitude' ? 'Longitude (°E)' : 'Latitude (°N)';
  const yLabel = 'Depth (dbar)';

  // Grid lines
  const xTicks = 5;
  const yTicks = 5;

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-slate-300">{title}</h3>
      <div className="inline-block rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ maxWidth: '600px' }}>
          {/* Grid */}
          {Array.from({ length: xTicks + 1 }, (_, i) => {
            const x = padL + (i / xTicks) * plotW;
            const val = xMin + (i / xTicks) * (xMax - xMin);
            return (
              <g key={`x${i}`}>
                <line x1={x} y1={padT} x2={x} y2={chartH - padB} stroke="#1e293b" strokeWidth="0.5" />
                <text x={x} y={chartH - padB + 14} textAnchor="middle" fill="#64748b" fontSize="8">
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}
          {Array.from({ length: yTicks + 1 }, (_, i) => {
            const y = padT + (i / yTicks) * plotH;
            const val = (i / yTicks) * yMax;
            return (
              <g key={`y${i}`}>
                <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#1e293b" strokeWidth="0.5" />
                <text x={padL - 5} y={y + 3} textAnchor="end" fill="#64748b" fontSize="8">
                  {val.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Axes labels */}
          <text x={padL + plotW / 2} y={chartH - 5} textAnchor="middle" fill="#94a3b8" fontSize="9">
            {xLabel}
          </text>
          <text x={12} y={padT + plotH / 2} textAnchor="middle" fill="#94a3b8" fontSize="9" transform={`rotate(-90, 12, ${padT + plotH / 2})`}>
            {yLabel}
          </text>

          {/* Data points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={toX(p[xAxis])}
              cy={toY(p[yAxis])}
              r={3}
              fill={getColor(p.argoValue)}
              opacity={0.8}
            >
              <title>{`${xAxis}: ${p[xAxis].toFixed(2)}\nDepth: ${p[yAxis].toFixed(1)} dbar\nArgo: ${p.argoValue.toFixed(2)} ${unit}\nGLORYS: ${p.glorysValue.toFixed(2)} ${unit}\nDiff: ${p.difference > 0 ? '+' : ''}${p.difference.toFixed(4)} ${unit}`}</title>
            </circle>
          ))}

          {/* Color scale */}
          <defs>
            <linearGradient id={`grad-${xAxis}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(240, 70%, 50%)" />
              <stop offset="50%" stopColor="hsl(120, 70%, 50%)" />
              <stop offset="100%" stopColor="hsl(0, 70%, 50%)" />
            </linearGradient>
          </defs>
          <rect x={padL} y={chartH - 18} width={plotW} height={6} rx={3} fill={`url(#grad-${xAxis})`} opacity={0.6} />
          <text x={padL} y={chartH - 22} fill="#64748b" fontSize="7">{minVal.toFixed(1)}</text>
          <text x={padL + plotW} y={chartH - 22} textAnchor="end" fill="#64748b" fontSize="7">{maxVal.toFixed(1)} {unit}</text>
        </svg>
        <p className="mt-2 text-[10px] text-slate-500">
          Color = {variable} (Argo) — {points.length} real observation points
        </p>
      </div>
    </div>
  );
}

function ComparisonChart({
  points,
  unit,
  variable,
}: {
  points: Research3DPoint[];
  unit: string;
  variable: string;
}) {
  // Group by unique depth (pressure) and average values
  const depthMap = new Map<number, { argo: number[]; glorys: number[] }>();
  for (const p of points) {
    const depth = Math.round(p.pressure * 10) / 10;
    if (!depthMap.has(depth)) depthMap.set(depth, { argo: [], glorys: [] });
    depthMap.get(depth)!.argo.push(p.argoValue);
    depthMap.get(depth)!.glorys.push(p.glorysValue);
  }

  const profilePoints = Array.from(depthMap.entries())
    .map(([depth, vals]) => ({
      depth,
      argo: vals.argo.reduce((a, b) => a + b, 0) / vals.argo.length,
      glorys: vals.glorys.reduce((a, b) => a + b, 0) / vals.glorys.length,
    }))
    .sort((a, b) => a.depth - b.depth);

  if (profilePoints.length === 0) return null;

  const allVals = profilePoints.flatMap((p) => [p.argo, p.glorys]);
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const maxDepth = Math.max(...profilePoints.map((p) => p.depth));
  const valRange = maxVal - minVal || 1;

  const chartW = 500;
  const chartH = 300;
  const padL = 50;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const toX = (val: number) => padL + ((val - minVal) / valRange) * plotW;
  const toY = (depth: number) => padT + (depth / (maxDepth || 1)) * plotH;

  const argoPath = profilePoints.map((p) => `${toX(p.argo)},${toY(p.depth)}`).join(' ');
  const glorysPath = profilePoints.map((p) => `${toX(p.glorys)},${toY(p.depth)}`).join(' ');

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-slate-300">Argo vs GLORYS Vertical Profile</h3>
      <div className="inline-block rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ maxWidth: '600px' }}>
          {/* Depth axis (Y, inverted: 0 at top) */}
          {Array.from({ length: 6 }, (_, i) => {
            const depth = (i / 5) * maxDepth;
            const y = toY(depth);
            return (
              <g key={i}>
                <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#1e293b" strokeWidth="0.5" />
                <text x={padL - 5} y={y + 3} textAnchor="end" fill="#64748b" fontSize="8">
                  {depth.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Value axis (X) */}
          {Array.from({ length: 5 }, (_, i) => {
            const val = minVal + (i / 4) * valRange;
            const x = toX(val);
            return (
              <g key={i}>
                <line x1={x} y1={padT} x2={x} y2={chartH - padB} stroke="#1e293b" strokeWidth="0.5" />
                <text x={x} y={chartH - padB + 14} textAnchor="middle" fill="#64748b" fontSize="8">
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Argo line (dashed) */}
          <polyline points={argoPath} fill="none" stroke="#a855f7" strokeWidth="2" strokeDasharray="4 2" />

          {/* GLORYS line (solid) */}
          <polyline points={glorysPath} fill="none" stroke="#06b6d4" strokeWidth="2" />

          {/* Data points */}
          {profilePoints.map((p, i) => (
            <g key={i}>
              <circle cx={toX(p.argo)} cy={toY(p.depth)} r={2.5} fill="#a855f7" />
              <circle cx={toX(p.glorys)} cy={toY(p.depth)} r={2.5} fill="#06b6d4" />
            </g>
          ))}

          {/* Legend */}
          <line x1={padL + 10} y1={chartH - 8} x2={padL + 30} y2={chartH - 8} stroke="#a855f7" strokeWidth="2" strokeDasharray="4 2" />
          <text x={padL + 34} y={chartH - 5} fill="#94a3b8" fontSize="8">Argo</text>
          <line x1={padL + 80} y1={chartH - 8} x2={padL + 100} y2={chartH - 8} stroke="#06b6d4" strokeWidth="2" />
          <text x={padL + 104} y={chartH - 5} fill="#94a3b8" fontSize="8">GLORYS</text>

          {/* Axis labels */}
          <text x={padL + plotW / 2} y={chartH - 20} textAnchor="middle" fill="#94a3b8" fontSize="9">
            {variable} ({unit})
          </text>
          <text x={12} y={padT + plotH / 2} textAnchor="middle" fill="#94a3b8" fontSize="9" transform={`rotate(-90, 12, ${padT + plotH / 2})`}>
            Depth (dbar)
          </text>
        </svg>
        <p className="mt-2 text-[10px] text-slate-500">
          Averaged profile from {points.length} real observations — {profilePoints.length} unique depth levels
        </p>
      </div>
    </div>
  );
}

function ObservationTable({
  points,
  unit,
  variable,
}: {
  points: Research3DPoint[];
  unit: string;
  variable: string;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-slate-300">Observation Details</h3>
      <div className="rounded-lg border border-slate-800 bg-slate-900/30 overflow-hidden">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/50">
              <th className="px-2 py-1.5 text-left text-slate-500 font-medium">Lat</th>
              <th className="px-2 py-1.5 text-left text-slate-500 font-medium">Lon</th>
              <th className="px-2 py-1.5 text-right text-slate-500 font-medium">Depth</th>
              <th className="px-2 py-1.5 text-right text-slate-500 font-medium">Argo</th>
              <th className="px-2 py-1.5 text-right text-slate-500 font-medium">GLORYS</th>
              <th className="px-2 py-1.5 text-right text-slate-500 font-medium">Diff</th>
              <th className="px-2 py-1.5 text-left text-slate-500 font-medium">Platform</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="px-2 py-1 text-slate-300">{p.latitude.toFixed(2)}</td>
                <td className="px-2 py-1 text-slate-300">{p.longitude.toFixed(2)}</td>
                <td className="px-2 py-1 text-right text-slate-300">{p.pressure.toFixed(1)}</td>
                <td className="px-2 py-1 text-right text-purple-300">{p.argoValue.toFixed(2)}</td>
                <td className="px-2 py-1 text-right text-cyan-300">{p.glorysValue.toFixed(2)}</td>
                <td className={`px-2 py-1 text-right ${p.difference >= 0 ? 'text-amber-300' : 'text-blue-300'}`}>
                  {p.difference > 0 ? '+' : ''}{p.difference.toFixed(4)}
                </td>
                <td className="px-2 py-1 text-slate-400">{p.platformNumber}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
