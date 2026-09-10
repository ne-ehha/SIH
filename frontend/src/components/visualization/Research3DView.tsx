/**
 * Research3DView — GLORYS × Argo Research Visualization
 *
 * Displays real collocated observations as a 3D point cloud.
 * X = longitude, Y = depth (pressure), color = value or difference.
 *
 * This is NOT a complete 3D ocean model — it visualizes the actual
 * sparse, irregularly spaced GLORYS × Argo collocated observations.
 */

import { useRef, useState } from 'react';
import { useOceanStore } from '@/state/oceanStore';
import { useResearchVisualization3D } from '@/integration';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { DepthInspectorScene, type InspectorViewControls } from './research3d/DepthInspectorScene';
import type { Research3DPoint } from '@/integration';

export function Research3DView() {
  const [selectedPoint, setSelectedPoint] = useState<Research3DPoint | null>(null);
  const viewControlsRef = useRef<InspectorViewControls | null>(null);
  const {
    selectedLocation,
    selectedVariable,
    selectedDate,
    selectedTime,
    selectedObservationId,
    selectedDepth,
    isModelViewOpen,
    setIsModelViewOpen,
  } = useOceanStore();

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
    variable: selectedVariable,
    date: selectedDate,
    time: selectedTime,
    selectedObservationId,
    selectedDepth,
  });

  if (!isModelViewOpen || !selectedLocation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(8,12,22,0.85)' }}>
      <div className="mx-4 flex h-[90vh] w-full max-w-6xl flex-col border" style={{ borderColor: 'var(--os-border)', background: 'var(--os-bg)' }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--os-border)' }}>
          <div>
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--os-text)' }}>Research 3D — GLORYS × Argo</h2>
            <p className="text-[11px]" style={{ color: 'var(--os-text-3)' }}>
              {selectedLocation.latitude.toFixed(2)}° {selectedLocation.latitude >= 0 ? 'N' : 'S'},{' '}
              {selectedLocation.longitude.toFixed(2)}° {selectedLocation.longitude >= 0 ? 'E' : 'W'}
              {unit && <span className="ml-2" style={{ color: 'var(--os-argo)' }}>• {selectedVariable} ({unit})</span>}
              <span className="ml-2" style={{ color: 'var(--os-glorys)' }}>• {selectedDate}</span>
            </p>
            <p className="mt-0.5 text-[10px]" style={{ color: 'var(--os-text-muted)' }}>
              Real GLORYS12V1 × Argo Delayed Mode collocated observations — not a gridded model
            </p>
          </div>
          <button
            onClick={() => setIsModelViewOpen(false)}
            className="p-2 transition"
            style={{ color: 'var(--os-text-3)' }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar: stats + legend */}
          <div className="w-72 border-r p-4 overflow-y-auto space-y-4" style={{ borderColor: 'var(--os-border)' }}>
            {stats && (
              <>
                <div className="border p-3" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
                  <h4 className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--os-text-muted)' }}>Dataset Summary</h4>
                  <div className="space-y-1.5 text-[11px]">
                    <Row label="Total points" value={String(stats.totalPoints)} />
                    <Row label="Argo mean" value={`${stats.argoMean.toFixed(2)} ${unit}`} color="var(--os-argo)" />
                    <Row label="GLORYS mean" value={`${stats.glorysMean.toFixed(2)} ${unit}`} color="var(--os-glorys)" />
                    <Row label="Mean difference" value={`${stats.meanDifference > 0 ? '+' : ''}${stats.meanDifference.toFixed(4)} ${unit}`} color={stats.meanDifference >= 0 ? 'var(--os-diff-pos)' : 'var(--os-diff-neg)'} />
                    <Row label="RMS difference" value={`${stats.rmsDifference.toFixed(4)} ${unit}`} />
                    <Row label="Max |difference|" value={`${stats.maxDifference.toFixed(4)} ${unit}`} />
                  </div>
                </div>

                <div className="border p-3" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
                  <h4 className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--os-text-muted)' }}>Coverage</h4>
                  <div className="space-y-1.5 text-[11px]">
                    <Row label="Depth range" value={`${stats.depthRange[0]}–${stats.depthRange[1]} dbar`} />
                    <Row label="Lat range" value={`${stats.spatialBounds.south}–${stats.spatialBounds.north}°N`} />
                    <Row label="Lon range" value={`${stats.spatialBounds.west}–${stats.spatialBounds.east}°E`} />
                  </div>
                </div>
              </>
            )}

            <div className="border p-3" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
              <h4 className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--os-text-muted)' }}>Legend</h4>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: 'var(--os-argo)' }} />
                  <span style={{ color: 'var(--os-text-2)' }}>Argo observation</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: 'var(--os-glorys)' }} />
                  <span style={{ color: 'var(--os-text-2)' }}>GLORYS model</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: 'var(--os-diff-pos)' }} />
                  <span style={{ color: 'var(--os-text-2)' }}>Positive diff (model high)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: 'var(--os-diff-neg)' }} />
                  <span style={{ color: 'var(--os-text-2)' }}>Negative diff (model low)</span>
                </div>
              </div>
            </div>              <div className="border p-3" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
              <p className="text-[10px] italic" style={{ color: 'var(--os-text-3)' }}>
                Source: GLORYS12V1 × Argo Delayed Mode collocation
              </p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--os-text-muted)' }}>
                {points.length} real observation points for {selectedDate}
              </p>
            </div>
          </div>

          {/* Main visualization */}
          <div className="flex-1 relative overflow-hidden">
            <div className="h-full w-full overflow-y-auto p-6" style={{ background: 'var(--os-bg)' }}>
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
                  <p className="text-[13px]" style={{ color: 'var(--os-text-3)' }}>No collocation observations for this date</p>
                </div>
              )}
              {!loading && !error && points.length > 0 && (
                <div className="space-y-8">
                  {/* 3D Depth Inspector (R3F Canvas) */}
                  <div>
                    <h3 className="mb-2 text-[13px] font-medium" style={{ color: 'var(--os-text)' }}>3D Depth Inspector</h3>
                    <div className="relative border" style={{ height: '400px', borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
                      <DepthInspectorScene
                        className="h-full w-full"
                        profilePoints={selectedProfilePoints}
                        unit={unit}
                        variable={selectedVariable}
                        selectedDepth={selectedDepth}
                        viewControlsRef={viewControlsRef}
                      />
                      <div className="absolute right-2 top-2 z-10 flex gap-1" aria-label="3D view controls">
                        <button type="button" onClick={() => viewControlsRef.current?.zoomIn()} className="border px-2 py-1 text-[10px]" style={{ borderColor: 'var(--os-border)', color: 'var(--os-text-2)', background: 'var(--os-surface)' }}>
                          Zoom In
                        </button>
                        <button type="button" onClick={() => viewControlsRef.current?.zoomOut()} className="border px-2 py-1 text-[10px]" style={{ borderColor: 'var(--os-border)', color: 'var(--os-text-2)', background: 'var(--os-surface)' }}>
                          Zoom Out
                        </button>
                        <button type="button" onClick={() => viewControlsRef.current?.resetView()} className="border px-2 py-1 text-[10px]" style={{ borderColor: 'var(--os-border)', color: 'var(--os-text-2)', background: 'var(--os-surface)' }}>
                          Reset View
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t pt-2 text-[10px]" style={{ borderColor: 'var(--os-border)', color: 'var(--os-text-3)' }}>
                      <span>Depth is controlled in the Research workspace.</span>
                      <span className="font-mono tabular-nums" style={{ color: 'var(--os-argo)' }}>{selectedDepth} m</span>
                    </div>
                    {selectedProfilePoints.length > 0 && (
                      <p className="mt-2 text-[10px]" style={{ color: 'var(--os-text-3)' }}>
                        {selectedProfilePoints.length} depth records — Platform {selectedProfilePoints[0].platformNumber}, Cycle {selectedProfilePoints[0].cycleNumber}
                      </p>
                    )}
                    {selectedObservationId && selectedProfilePoints.length === 0 && !loading && (
                      <p className="mt-2 text-[10px]" style={{ color: 'var(--os-diff-pos)' }}>
                        No matching profile found for {selectedObservationId} on {selectedDate}
                      </p>
                    )}
                    {!selectedObservationId && (
                      <p className="mt-2 text-[10px]" style={{ color: 'var(--os-text-3)' }}>
                        Click an Argo observation marker on the globe to view its profile in 3D
                      </p>
                    )}
                  </div>

                  {/* Selected observation detail panel */}
                  {selectedPoint && (
                    <SelectedPointDetail point={selectedPoint} unit={unit} onClose={() => setSelectedPoint(null)} />
                  )}

                  {/* Scatter plot: Longitude vs Depth */}
                  <ScatterPlot
                    points={points}
                    unit={unit}
                    variable={selectedVariable}
                    title="Longitude vs Depth"
                    xAxis="longitude"
                    yAxis="pressure"
                    onSelectPoint={setSelectedPoint}
                    selectedPoint={selectedPoint}
                  />

                  {/* Scatter plot: Latitude vs Depth */}
                  <ScatterPlot
                    points={points}
                    unit={unit}
                    variable={selectedVariable}
                    title="Latitude vs Depth"
                    xAxis="latitude"
                    yAxis="pressure"
                    onSelectPoint={setSelectedPoint}
                    selectedPoint={selectedPoint}
                  />

                  {/* Comparison chart: Argo vs GLORYS at each depth */}
                  <ComparisonChart
                    points={selectedProfilePoints}
                    unit={unit}
                    variable={selectedVariable}
                    selectedMeasurement={selectedMeasurement}
                  />

                  {/* Observation table (first 20) */}
                  <ObservationTable
                    points={selectedProfilePoints.slice(0, 20)}
                    unit={unit}
                    variable={selectedVariable}
                    selectedMeasurement={selectedMeasurement}
                    onSelectPoint={setSelectedPoint}
                  />
                  {selectedProfilePoints.length > 20 && (
                    <p className="text-[10px] text-center" style={{ color: 'var(--os-text-muted)' }}>
                      Showing 20 of {selectedProfilePoints.length} profile observations
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
      <span style={{ color: 'var(--os-text-3)' }}>{label}</span>
      <span className="font-medium" style={{ color: color || 'var(--os-text-2)' }}>{value}</span>
    </div>
  );
}

function SelectedPointDetail({ point, unit, onClose }: { point: Research3DPoint; unit: string; onClose: () => void }) {
  return (
    <div className="border p-4" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium" style={{ color: 'var(--os-argo)' }}>Selected Observation</h3>
        <button onClick={onClose} className="text-xs" style={{ color: 'var(--os-text-3)' }}>Close</button>
      </div>
        <div className="grid grid-cols-4 gap-3 text-[11px]">
          <div><span style={{ color: 'var(--os-text-3)' }}>Latitude</span><p style={{ color: 'var(--os-text)' }}>{point.latitude.toFixed(4)}°N</p></div>
          <div><span style={{ color: 'var(--os-text-3)' }}>Longitude</span><p style={{ color: 'var(--os-text)' }}>{point.longitude.toFixed(4)}°E</p></div>
          <div><span style={{ color: 'var(--os-text-3)' }}>Depth</span><p style={{ color: 'var(--os-text)' }}>{point.pressure.toFixed(1)} dbar</p></div>
          <div><span style={{ color: 'var(--os-text-3)' }}>Timestamp</span><p style={{ color: 'var(--os-text)' }}>{point.timestamp}</p></div>
          <div><span style={{ color: 'var(--os-text-3)' }}>Argo</span><p style={{ color: 'var(--os-argo)' }}>{point.argoValue.toFixed(2)} {unit}</p></div>
          <div><span style={{ color: 'var(--os-text-3)' }}>GLORYS</span><p style={{ color: 'var(--os-glorys)' }}>{point.glorysValue.toFixed(2)} {unit}</p></div>
          <div><span style={{ color: 'var(--os-text-3)' }}>Difference</span><p style={{ color: point.difference >= 0 ? 'var(--os-diff-pos)' : 'var(--os-diff-neg)' }}>{point.difference > 0 ? '+' : ''}{point.difference.toFixed(4)} {unit}</p></div>
          <div><span style={{ color: 'var(--os-text-3)' }}>Platform</span><p style={{ color: 'var(--os-text)' }}>{point.platformNumber} / Cycle {point.cycleNumber}</p></div>
        </div>
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
  onSelectPoint,
  selectedPoint,
}: {
  points: Research3DPoint[];
  unit: string;
  variable: string;
  title: string;
  xAxis: 'longitude' | 'latitude';
  yAxis: 'pressure';
  onSelectPoint?: (point: Research3DPoint) => void;
  selectedPoint?: Research3DPoint | null;
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
      <h3 className="mb-2 text-[13px] font-medium" style={{ color: 'var(--os-text)' }}>{title}</h3>
      <div className="inline-block border p-4" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ maxWidth: '600px' }}>
          {/* Grid */}
          {Array.from({ length: xTicks + 1 }, (_, i) => {
            const x = padL + (i / xTicks) * plotW;
            const val = xMin + (i / xTicks) * (xMax - xMin);
            return (
              <g key={`x${i}`}>
                <line x1={x} y1={padT} x2={x} y2={chartH - padB} stroke="var(--os-border)" strokeWidth="0.5" />
                <text x={x} y={chartH - padB + 14} textAnchor="middle" fill="var(--os-text-3)" fontSize="8">
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
                <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="var(--os-border)" strokeWidth="0.5" />
                <text x={padL - 5} y={y + 3} textAnchor="end" fill="var(--os-text-3)" fontSize="8">
                  {val.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Axes labels */}
          <text x={padL + plotW / 2} y={chartH - 5} textAnchor="middle" fill="var(--os-text-2)" fontSize="9">
            {xLabel}
          </text>
          <text x={12} y={padT + plotH / 2} textAnchor="middle" fill="var(--os-text-2)" fontSize="9" transform={`rotate(-90, 12, ${padT + plotH / 2})`}>
            {yLabel}
          </text>

          {/* Data points */}
          {points.map((p, i) => {
            const isSelected = selectedPoint && selectedPoint.latitude === p.latitude && selectedPoint.longitude === p.longitude && selectedPoint.pressure === p.pressure;
            return (
              <circle
                key={i}
                cx={toX(p[xAxis])}
                cy={toY(p[yAxis])}
                r={isSelected ? 5 : 3}
                fill={isSelected ? '#ffffff' : getColor(p.argoValue)}
                stroke={isSelected ? getColor(p.argoValue) : 'none'}
                strokeWidth={isSelected ? 2 : 0}
                opacity={0.8}
                style={{ cursor: onSelectPoint ? 'pointer' : 'default' }}
                onClick={() => onSelectPoint?.(p)}
              >
                <title>{`${xAxis}: ${p[xAxis].toFixed(2)}\nDepth: ${p[yAxis].toFixed(1)} dbar\nArgo: ${p.argoValue.toFixed(2)} ${unit}\nGLORYS: ${p.glorysValue.toFixed(2)} ${unit}\nDiff: ${p.difference > 0 ? '+' : ''}${p.difference.toFixed(4)} ${unit}`}</title>
              </circle>
            );
          })}

          {/* Color scale */}
          <defs>
            <linearGradient id={`grad-${xAxis}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(240, 70%, 50%)" />
              <stop offset="50%" stopColor="hsl(120, 70%, 50%)" />
              <stop offset="100%" stopColor="hsl(0, 70%, 50%)" />
            </linearGradient>
          </defs>
          <rect x={padL} y={chartH - 18} width={plotW} height={6} rx={3} fill={`url(#grad-${xAxis})`} opacity={0.6} />
          <text x={padL} y={chartH - 22} fill="var(--os-text-3)" fontSize="7">{minVal.toFixed(1)}</text>
          <text x={padL + plotW} y={chartH - 22} textAnchor="end" fill="var(--os-text-3)" fontSize="7">{maxVal.toFixed(1)} {unit}</text>
        </svg>                    <p className="mt-2 text-[10px]" style={{ color: 'var(--os-text-3)' }}>
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
  selectedMeasurement,
}: {
  points: Research3DPoint[];
  unit: string;
  variable: string;
  selectedMeasurement: Research3DPoint | null;
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
      <h3 className="mb-2 text-[13px] font-medium" style={{ color: 'var(--os-text)' }}>Argo vs GLORYS Vertical Profile</h3>
      <div className="inline-block border p-4" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ maxWidth: '600px' }}>
          {/* Depth axis (Y, inverted: 0 at top) */}
          {Array.from({ length: 6 }, (_, i) => {
            const depth = (i / 5) * maxDepth;
            const y = toY(depth);
            return (
              <g key={i}>
                <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="var(--os-border)" strokeWidth="0.5" />
                <text x={padL - 5} y={y + 3} textAnchor="end" fill="var(--os-text-3)" fontSize="8">
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
                <line x1={x} y1={padT} x2={x} y2={chartH - padB} stroke="var(--os-border)" strokeWidth="0.5" />
                <text x={x} y={chartH - padB + 14} textAnchor="middle" fill="var(--os-text-3)" fontSize="8">
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Argo line (dashed) */}
          <polyline points={argoPath} fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="4 2" />

          {/* GLORYS line (solid) */}
          <polyline points={glorysPath} fill="none" stroke="#a855f7" strokeWidth="2" />

          {/* Data points */}
          {profilePoints.map((p, i) => (
            <g key={i}>
              <circle cx={toX(p.argo)} cy={toY(p.depth)} r={2.5} fill="#22d3ee" />
              <circle cx={toX(p.glorys)} cy={toY(p.depth)} r={2.5} fill="#a855f7" />
            </g>
          ))}

          {selectedMeasurement && (
            <g>
              <line x1={padL} y1={toY(selectedMeasurement.pressure)} x2={chartW - padR} y2={toY(selectedMeasurement.pressure)} stroke="#06b6d4" strokeWidth="1" strokeDasharray="3 2" />
              <circle cx={toX(selectedMeasurement.argoValue)} cy={toY(selectedMeasurement.pressure)} r={4} fill="none" stroke="#f8fafc" strokeWidth="1.5" />
              <circle cx={toX(selectedMeasurement.glorysValue)} cy={toY(selectedMeasurement.pressure)} r={4} fill="none" stroke="#f8fafc" strokeWidth="1.5" />
            </g>
          )}

          {/* Legend */}
          <line x1={padL + 10} y1={chartH - 8} x2={padL + 30} y2={chartH - 8} stroke="#22d3ee" strokeWidth="2" strokeDasharray="4 2" />
          <text x={padL + 34} y={chartH - 5} fill="var(--os-text-2)" fontSize="9">Argo</text>
          <line x1={padL + 80} y1={chartH - 8} x2={padL + 100} y2={chartH - 8} stroke="#a855f7" strokeWidth="2" />
          <text x={padL + 104} y={chartH - 5} fill="var(--os-text-2)" fontSize="9">GLORYS</text>

          {/* Axis labels */}
          <text x={padL + plotW / 2} y={chartH - 20} textAnchor="middle" fill="var(--os-text-2)" fontSize="9">
            {variable} ({unit})
          </text>
          <text x={12} y={padT + plotH / 2} textAnchor="middle" fill="var(--os-text-2)" fontSize="9" transform={`rotate(-90, 12, ${padT + plotH / 2})`}>
            Depth (dbar)
          </text>
        </svg>                    <p className="mt-2 text-[10px]" style={{ color: 'var(--os-text-3)' }}>
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
  selectedMeasurement,
  onSelectPoint,
}: {
  points: Research3DPoint[];
  unit: string;
  variable: string;
  selectedMeasurement: Research3DPoint | null;
  onSelectPoint?: (point: Research3DPoint) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-medium" style={{ color: 'var(--os-text)' }}>Observation Details</h3>
      <div className="border overflow-hidden" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface-2)' }}>
              <th className="px-2 py-1.5 text-left font-medium" style={{ color: 'var(--os-text-3)' }}>Lat</th>
              <th className="px-2 py-1.5 text-left font-medium" style={{ color: 'var(--os-text-3)' }}>Lon</th>
              <th className="px-2 py-1.5 text-right font-medium" style={{ color: 'var(--os-text-3)' }}>Depth</th>
              <th className="px-2 py-1.5 text-right font-medium" style={{ color: 'var(--os-text-3)' }}>Argo</th>
              <th className="px-2 py-1.5 text-right font-medium" style={{ color: 'var(--os-text-3)' }}>GLORYS</th>
              <th className="px-2 py-1.5 text-right font-medium" style={{ color: 'var(--os-text-3)' }}>Diff</th>
              <th className="px-2 py-1.5 text-left font-medium" style={{ color: 'var(--os-text-3)' }}>Platform</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => {
              const isSelected = selectedMeasurement?.platformNumber === p.platformNumber
                && selectedMeasurement?.cycleNumber === p.cycleNumber
                && selectedMeasurement?.pressure === p.pressure;
              return (
              <tr key={i} className="border-b" onClick={() => onSelectPoint?.(p)} style={{ cursor: onSelectPoint ? 'pointer' : 'default' }}>
                <td className="px-2 py-1" style={{ color: 'var(--os-text)' }}>{p.latitude.toFixed(2)}</td>
                <td className="px-2 py-1" style={{ color: 'var(--os-text)' }}>{p.longitude.toFixed(2)}</td>
                <td className="px-2 py-1 text-right" style={{ color: 'var(--os-text)' }}>{p.pressure.toFixed(1)}</td>
                <td className="px-2 py-1 text-right" style={{ color: 'var(--os-argo)' }}>{p.argoValue.toFixed(2)}</td>
                <td className="px-2 py-1 text-right" style={{ color: 'var(--os-glorys)' }}>{p.glorysValue.toFixed(2)}</td>
                <td className="px-2 py-1 text-right" style={{ color: p.difference >= 0 ? 'var(--os-diff-pos)' : 'var(--os-diff-neg)' }}>
                  {p.difference > 0 ? '+' : ''}{p.difference.toFixed(4)}
                </td>
                <td className="px-2 py-1" style={{ color: 'var(--os-text-3)' }}>{p.platformNumber}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
