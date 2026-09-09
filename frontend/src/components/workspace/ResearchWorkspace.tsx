import { useState } from 'react';
import { useOceanStore } from '@/state/oceanStore';
import { useResearchVisualization3D } from '@/integration';
import { DepthInspectorScene } from '@/components/visualization/research3d/DepthInspectorScene';
import type { Research3DPoint } from '@/integration';

type ResearchTab = 'inspector' | 'comparison' | 'profiles' | 'observations';

export function ResearchWorkspace() {
  const [activeTab, setActiveTab] = useState<ResearchTab>('inspector');
  const {
    selectedLocation,
    selectedObservationId,
    selectedVariable,
    selectedDate,
    selectedTime,
    selectedDepth,
    setSelectedDepth,
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

  const hasSelection = selectedObservationId !== null && selectedLocation !== null;

  const tabs: { id: ResearchTab; label: string }[] = [
    { id: 'inspector', label: '3D Inspector' },
    { id: 'comparison', label: 'Comparison' },
    { id: 'profiles', label: 'Profiles' },
    { id: 'observations', label: 'Observations' },
  ];

  if (!hasSelection) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-xs">
          <p className="text-[13px] font-medium" style={{ color: 'var(--os-text-2)' }}>
            No observation selected
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'var(--os-text-3)' }}>
            Select a real Argo profile from the Globe to inspect it through depth.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Research header */}
      <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-bold uppercase tracking-wider" style={{ color: 'var(--os-text)' }}>
            Research
          </span>
          <span style={{ color: 'var(--os-text-3)' }}>·</span>
          <span className="text-[14px] font-bold uppercase tracking-wider" style={{ color: 'var(--os-argo)' }}>
            Inspect
          </span>
          <span className="h-3 w-px" style={{ background: 'var(--os-border)' }} />
          <span className="mono text-[11px] font-medium" style={{ color: 'var(--os-argo)' }}>
            {selectedObservationId.replace('argo_', 'ARGO ').replace('_', ' · Cycle ')}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="mono text-[11px]" style={{ color: 'var(--os-text-2)' }}>
            {selectedDate}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--os-text-3)' }}>·</span>
          <span className="text-[11px]" style={{ color: 'var(--os-text-2)' }}>
            {selectedVariable}
          </span>
          <button
            onClick={() => setIsModelViewOpen(true)}
            className="rounded border px-2 py-0.5 text-[10px] transition"
            style={{ borderColor: 'var(--os-border-light)', color: 'var(--os-text-2)' }}
          >
            Full 3D View
          </button>
        </div>
      </div>

      {/* Secondary tabs */}
      <div className="flex items-center gap-0 border-b px-3" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-3 py-1.5 text-[11px] font-medium transition-colors ${
              activeTab === tab.id
                ? 'workspace-tab-active'
                : ''
            }`}
            style={{ color: activeTab === tab.id ? 'var(--os-accent)' : 'var(--os-text-3)' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div key={activeTab} className="flex-1 overflow-hidden subtab-enter">
        {/* ── 3D Inspector Tab ──────────────────────────────── */}
        {activeTab === 'inspector' && (
          <div className="flex h-full">
            {/* Main 3D surface */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-3">
                {loading && (
                  <div className="flex h-96 items-center justify-center">
                    <LoadingIndicator />
                  </div>
                )}
                {error && !loading && (
                  <div className="flex h-96 items-center justify-center">
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}
                {!loading && !error && points.length === 0 && (
                  <div className="flex h-96 items-center justify-center">
                    <p className="text-[11px]" style={{ color: 'var(--os-text-3)' }}>No collocation data for this date</p>
                  </div>
                )}
                {!loading && !error && points.length > 0 && (
                  <>
                    {/* Selected depth evidence — prominent scientific readings */}
                    {selectedMeasurement && (
                      <div className="mb-3 rounded border p-3" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
                        {/* Depth: requested vs nearest real */}
                        <div className="flex items-start gap-6 mb-2">
                          <div>
                            <div className="research-sci-label">Requested Depth</div>
                            <div className="mt-0.5 flex items-baseline gap-1">
                              <span className="research-depth-badge">
                                <span className="depth-value" style={{ color: 'var(--os-text-2)' }}>{selectedDepth}</span>
                                <span className="depth-unit">m</span>
                              </span>
                            </div>
                          </div>
                          <div>
                            <div className="research-sci-label">Nearest Real Measurement</div>
                            <div className="mt-0.5 flex items-baseline gap-1">
                              <span className="research-depth-badge">
                                <span className="depth-value">{selectedMeasurement.pressure.toFixed(0)}</span>
                                <span className="depth-unit">dbar</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-6">
                          {/* Argo */}
                          <div>
                            <div className="research-sci-label" style={{ color: 'var(--os-argo)' }}>Argo</div>
                            <div className="mt-0.5 flex items-baseline gap-1">
                              <span className="research-sci-value" style={{ color: 'var(--os-argo)' }}>
                                {selectedMeasurement.argoValue.toFixed(2)}
                              </span>
                              <span className="text-[11px]" style={{ color: 'var(--os-text-3)' }}>{unit}</span>
                            </div>
                          </div>

                          {/* GLORYS */}
                          <div>
                            <div className="research-sci-label" style={{ color: 'var(--os-glorys)' }}>GLORYS12V1</div>
                            <div className="mt-0.5 flex items-baseline gap-1">
                              <span className="research-sci-value" style={{ color: 'var(--os-glorys)' }}>
                                {selectedMeasurement.glorysValue.toFixed(2)}
                              </span>
                              <span className="text-[11px]" style={{ color: 'var(--os-text-3)' }}>{unit}</span>
                            </div>
                          </div>

                          {/* Difference */}
                          <div>
                            <div className="research-sci-label">GLORYS − Argo</div>
                            <div className="mt-0.5 flex items-baseline gap-1">
                              <span
                                className="research-sci-value"
                                style={{ color: selectedMeasurement.difference >= 0 ? 'var(--os-diff-pos)' : 'var(--os-diff-neg)' }}
                              >
                                {selectedMeasurement.difference > 0 ? '+' : ''}{selectedMeasurement.difference.toFixed(2)}
                              </span>
                              <span className="text-[11px]" style={{ color: 'var(--os-text-3)' }}>{unit}</span>
                              <span
                                className="research-evidence-diff-label"
                                style={{ color: selectedMeasurement.difference >= 0 ? 'var(--os-diff-pos)' : 'var(--os-diff-neg)' }}
                              >
                                {selectedMeasurement.difference >= 0 ? 'MODEL HIGH' : 'MODEL LOW'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded border" style={{ height: '480px', borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
                      <DepthInspectorScene
                        className="h-full w-full"
                        profilePoints={selectedProfilePoints}
                        unit={unit}
                        variable={selectedVariable}
                        selectedDepth={selectedDepth}
                      />
                    </div>

                    {/* Depth control — compact */}
                    <div className="mt-2 flex items-center gap-3">
                      <label className="text-[9px] uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--os-text-muted)' }}>Depth</label>
                      <input
                        type="range"
                        min={0}
                        max={500}
                        step={1}
                        value={selectedDepth}
                        onChange={(e) => setSelectedDepth(Number(e.target.value))}
                        className="flex-1"
                      />
                      <span className="mono text-[11px] w-10 text-right" style={{ color: 'var(--os-argo)' }}>{selectedDepth}m</span>
                    </div>

                    {selectedProfilePoints.length > 0 && (
                      <p className="mt-1.5 text-[9px]" style={{ color: 'var(--os-text-3)' }}>
                        {selectedProfilePoints.length} depth records · Platform {selectedProfilePoints[0].platformNumber} · Cycle {selectedProfilePoints[0].cycleNumber}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Side panel — verification evidence */}
            <div className="w-56 shrink-0 overflow-y-auto border-l p-2.5 space-y-2.5" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
              {stats && (
                <>
                  <SidePanel title="Verification">
                    <SidePanelRow label="Points" value={String(stats.totalPoints)} />
                    <SidePanelRow label="Argo mean" value={`${stats.argoMean.toFixed(2)} ${unit}`} color="var(--os-argo)" />
                    <SidePanelRow label="GLORYS mean" value={`${stats.glorysMean.toFixed(2)} ${unit}`} color="var(--os-glorys)" />
                    <SidePanelRow
                      label="Mean diff"
                      value={`${stats.meanDifference > 0 ? '+' : ''}${stats.meanDifference.toFixed(4)} ${unit}`}
                      color={stats.meanDifference >= 0 ? 'var(--os-diff-pos)' : 'var(--os-diff-neg)'}
                    />
                    <SidePanelRow label="RMS" value={`${stats.rmsDifference.toFixed(4)} ${unit}`} />
                    <SidePanelRow label="Max |Δ|" value={`${stats.maxDifference.toFixed(4)} ${unit}`} />
                  </SidePanel>

                  <SidePanel title="Coverage">
                    <SidePanelRow label="Depth" value={`${stats.depthRange[0]}–${stats.depthRange[1]} dbar`} />
                    <SidePanelRow label="Lat" value={`${stats.spatialBounds.south}–${stats.spatialBounds.north}\u00B0N`} />
                    <SidePanelRow label="Lon" value={`${stats.spatialBounds.west}–${stats.spatialBounds.east}\u00B0E`} />
                  </SidePanel>
                </>
              )}

              <SidePanel title="Legend">
                <LegendRow color="var(--os-argo)" label="Argo observation" />
                <LegendRow color="var(--os-glorys)" label="GLORYS model" />
                <LegendRow color="var(--os-diff-pos)" label="Positive diff (model high)" />
                <LegendRow color="var(--os-diff-neg)" label="Negative diff (model low)" />
                <LegendRow color="var(--os-selected)" label="Selected depth" />
              </SidePanel>

              <SidePanel title="Source">
                <p className="text-[9px]" style={{ color: 'var(--os-text-3)' }}>GLORYS12V1 × Argo Delayed Mode</p>
                <p className="text-[9px] mt-0.5" style={{ color: 'var(--os-text-3)' }}>{points.length} points for {selectedDate}</p>
              </SidePanel>

              <SidePanel title="Provenance">
                <ProvenanceRow label="Spatial match" value="0.25° grid" />
                <ProvenanceRow label="Temporal match" value="Daily nearest" />
                <ProvenanceRow label="Depth match" value="Nearest available" />
                <ProvenanceRow label="Difference" value="GLORYS − Argo" />
              </SidePanel>
            </div>
          </div>
        )}

        {/* ── Comparison Tab ────────────────────────────────── */}
        {activeTab === 'comparison' && (
          <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-3xl p-4">
              {selectedMeasurement ? (
                <div className="space-y-4">
                  {/* Selected depth evidence — primary readings */}
                  <div className="rounded border p-4" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
                    <div className="research-sci-label mb-2">Depth-Level Evidence</div>                      <div className="flex items-start gap-8">
                          <div>
                            <div className="research-sci-label">Nearest Real Measurement</div>
                            <div className="mt-0.5 flex items-baseline gap-1">
                              <span className="research-depth-badge">
                                <span className="depth-value">{selectedMeasurement.pressure.toFixed(0)}</span>
                                <span className="depth-unit">dbar</span>
                              </span>
                              {selectedDepth !== Math.round(selectedMeasurement.pressure) && (
                                <span className="text-[9px]" style={{ color: 'var(--os-text-muted)' }}>
                                  (requested: {selectedDepth} m)
                                </span>
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="research-sci-label" style={{ color: 'var(--os-argo)' }}>Argo</div>
                        <div className="mt-0.5 flex items-baseline gap-1">
                          <span className="research-sci-value" style={{ color: 'var(--os-argo)' }}>
                            {selectedMeasurement.argoValue.toFixed(2)}
                          </span>
                          <span className="text-[11px]" style={{ color: 'var(--os-text-3)' }}>{unit}</span>
                        </div>
                      </div>
                      <div>
                        <div className="research-sci-label" style={{ color: 'var(--os-glorys)' }}>GLORYS12V1</div>
                        <div className="mt-0.5 flex items-baseline gap-1">
                          <span className="research-sci-value" style={{ color: 'var(--os-glorys)' }}>
                            {selectedMeasurement.glorysValue.toFixed(2)}
                          </span>
                          <span className="text-[11px]" style={{ color: 'var(--os-text-3)' }}>{unit}</span>
                        </div>
                      </div>
                      <div>
                        <div className="research-sci-label">GLORYS − Argo</div>
                        <div className="mt-0.5 flex items-baseline gap-1">
                          <span
                            className="research-sci-value"
                            style={{ color: selectedMeasurement.difference >= 0 ? 'var(--os-diff-pos)' : 'var(--os-diff-neg)' }}
                          >
                            {selectedMeasurement.difference > 0 ? '+' : ''}{selectedMeasurement.difference.toFixed(2)}
                          </span>
                          <span className="text-[11px]" style={{ color: 'var(--os-text-3)' }}>{unit}</span>
                          <span
                            className="research-evidence-diff-label"
                            style={{ color: selectedMeasurement.difference >= 0 ? 'var(--os-diff-pos)' : 'var(--os-diff-neg)' }}
                          >
                            {selectedMeasurement.difference >= 0 ? 'MODEL HIGH' : 'MODEL LOW'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Evidence table — tabular, not cards */}
                  <div className="panel">
                    <div className="panel-header">Model Verification</div>
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th></th>
                            <th className="text-right" style={{ color: 'var(--os-argo)' }}>Argo</th>
                            <th className="text-right" style={{ color: 'var(--os-glorys)' }}>GLORYS</th>
                            <th className="text-right">Difference</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="font-medium" style={{ color: 'var(--os-text-2)' }}>{selectedVariable}</td>
                            <td className="text-right mono" style={{ color: 'var(--os-argo)' }}>{selectedMeasurement.argoValue.toFixed(4)}</td>
                            <td className="text-right mono" style={{ color: 'var(--os-glorys)' }}>{selectedMeasurement.glorysValue.toFixed(4)}</td>
                            <td className="text-right mono" style={{ color: selectedMeasurement.difference >= 0 ? 'var(--os-diff-pos)' : 'var(--os-diff-neg)' }}>
                              {selectedMeasurement.difference > 0 ? '+' : ''}{selectedMeasurement.difference.toFixed(4)} {unit}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Profile chart */}
                  <ComparisonProfileChart
                    points={selectedProfilePoints}
                    unit={unit}
                    variable={selectedVariable}
                    selectedMeasurement={selectedMeasurement}
                  />
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center">
                  <div className="text-center">
                    <p className="text-[13px] font-medium" style={{ color: 'var(--os-text-2)' }}>
                      No measurement at this depth
                    </p>
                    <p className="mt-1 text-[11px]" style={{ color: 'var(--os-text-3)' }}>
                      No real measurement within 50 dbar of {selectedDepth}m.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Profiles Tab ──────────────────────────────────── */}
        {activeTab === 'profiles' && (
          <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-3xl p-4">
              {selectedProfilePoints.length > 0 ? (
                <VerticalProfileChart
                  points={selectedProfilePoints}
                  unit={unit}
                  variable={selectedVariable}
                  selectedMeasurement={selectedMeasurement}
                />
              ) : (
                <div className="flex h-48 items-center justify-center">
                  <div className="text-center">
                    <p className="text-[13px] font-medium" style={{ color: 'var(--os-text-2)' }}>
                      No profile data
                    </p>
                    <p className="mt-1 text-[11px]" style={{ color: 'var(--os-text-3)' }}>
                      No profile data available for this observation.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Observations Tab ──────────────────────────────── */}
        {activeTab === 'observations' && (
          <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-4xl p-4">
              {selectedProfilePoints.length > 0 ? (
                <ObservationsTable
                  points={selectedProfilePoints}
                  unit={unit}
                  selectedMeasurement={selectedMeasurement}
                />
              ) : (
                <div className="flex h-48 items-center justify-center">
                  <div className="text-center">
                    <p className="text-[13px] font-medium" style={{ color: 'var(--os-text-2)' }}>
                      No observation records
                    </p>
                    <p className="mt-1 text-[11px]" style={{ color: 'var(--os-text-3)' }}>
                      No observation records available.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Side Panel ───────────────────────────────────────────────────

function SidePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <div className="panel-header">{title}</div>
      <div className="p-2.5 space-y-1">{children}</div>
    </div>
  );
}

function SidePanelRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between text-[10px]">
      <span style={{ color: 'var(--os-text-3)' }}>{label}</span>
      <span className="mono font-medium" style={{ color: color || 'var(--os-text-2)' }}>{value}</span>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      <span style={{ color: 'var(--os-text-3)' }}>{label}</span>
    </div>
  );
}

function ProvenanceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[9px]">
      <span className="uppercase tracking-wider" style={{ color: 'var(--os-text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--os-text-3)' }}>{value}</span>
    </div>
  );
}

// ── Loading ──────────────────────────────────────────────────────

function LoadingIndicator() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-t-transparent" style={{ borderColor: 'var(--os-argo)', borderTopColor: 'transparent' }} />
      <p className="text-[10px]" style={{ color: 'var(--os-text-3)' }}>Loading observation data...</p>
    </div>
  );
}

// ── Comparison Profile Chart (SVG) ───────────────────────────────

function ComparisonProfileChart({
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

  const chartW = 600;
  const chartH = 320;
  const padL = 50;
  const padR = 20;
  const padT = 15;
  const padB = 40;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const toX = (val: number) => padL + ((val - minVal) / valRange) * plotW;
  const toY = (depth: number) => padT + (depth / (maxDepth || 1)) * plotH;

  const argoPath = profilePoints.map((p) => `${toX(p.argo)},${toY(p.depth)}`).join(' ');
  const glorysPath = profilePoints.map((p) => `${toX(p.glorys)},${toY(p.depth)}`).join(' ');

  return (
    <div className="panel">
      <div className="panel-header">Argo vs GLORYS Vertical Profile</div>
      <div className="p-3">
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ maxWidth: '700px' }}>
          {Array.from({ length: 6 }, (_, i) => {
            const depth = (i / 5) * maxDepth;
            const y = toY(depth);
            return (
              <g key={i}>
                <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#1e293b" strokeWidth="0.5" />
                <text x={padL - 5} y={y + 3} textAnchor="end" fill="#475569" fontSize="9">{depth.toFixed(0)}</text>
              </g>
            );
          })}
          {Array.from({ length: 5 }, (_, i) => {
            const val = minVal + (i / 4) * valRange;
            const x = toX(val);
            return (
              <g key={i}>
                <line x1={x} y1={padT} x2={x} y2={chartH - padB} stroke="#1e293b" strokeWidth="0.5" />
                <text x={x} y={chartH - padB + 12} textAnchor="middle" fill="#475569" fontSize="9">{val.toFixed(1)}</text>
              </g>
            );
          })}
          <polyline points={argoPath} fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="5 3" />
          <polyline points={glorysPath} fill="none" stroke="#a855f7" strokeWidth="1.5" />
          {profilePoints.map((p, i) => (
            <g key={i}>
              <circle cx={toX(p.argo)} cy={toY(p.depth)} r={2} fill="#22d3ee" />
              <circle cx={toX(p.glorys)} cy={toY(p.depth)} r={2} fill="#a855f7" />
            </g>
          ))}
          {selectedMeasurement && (
            <g>
              <line x1={padL} y1={toY(selectedMeasurement.pressure)} x2={chartW - padR} y2={toY(selectedMeasurement.pressure)} stroke="#d4a843" strokeWidth="1" strokeDasharray="3 2" />
              <circle cx={toX(selectedMeasurement.argoValue)} cy={toY(selectedMeasurement.pressure)} r={3.5} fill="none" stroke="#f8fafc" strokeWidth="1" />
              <circle cx={toX(selectedMeasurement.glorysValue)} cy={toY(selectedMeasurement.pressure)} r={3.5} fill="none" stroke="#f8fafc" strokeWidth="1" />
            </g>
          )}
          <line x1={padL + 8} y1={chartH - 6} x2={padL + 24} y2={chartH - 6} stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="5 3" />
          <text x={padL + 28} y={chartH - 3.5} fill="#94a3b8" fontSize="9">Argo</text>
          <line x1={padL + 68} y1={chartH - 6} x2={padL + 84} y2={chartH - 6} stroke="#a855f7" strokeWidth="1.5" />
          <text x={padL + 88} y={chartH - 3.5} fill="#94a3b8" fontSize="9">GLORYS</text>
          <text x={padL + plotW / 2} y={chartH - 18} textAnchor="middle" fill="#64748b" fontSize="9">{variable} ({unit})</text>
          <text x={12} y={padT + plotH / 2} textAnchor="middle" fill="#64748b" fontSize="9" transform={`rotate(-90, 12, ${padT + plotH / 2})`}>Depth (dbar)</text>
        </svg>
        <p className="mt-2 text-[9px]" style={{ color: 'var(--os-text-3)' }}>
          {points.length} observations · {profilePoints.length} unique depth levels
        </p>
      </div>
    </div>
  );
}

// ── Vertical Profile Chart ───────────────────────────────────────

function VerticalProfileChart({
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
  const allVals = points.flatMap((p) => [p.glorysValue, p.argoValue]);
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const maxDepth = Math.max(...points.map((p) => p.pressure));
  const valRange = maxVal - minVal || 1;

  const chartW = 600;
  const chartH = 380;
  const padL = 50;
  const padR = 20;
  const padT = 15;
  const padB = 40;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const toX = (val: number) => padL + ((val - minVal) / valRange) * plotW;
  const toY = (depth: number) => padT + (depth / (maxDepth || 1)) * plotH;

  const argoPath = points.map((p) => `${toX(p.argoValue)},${toY(p.pressure)}`).join(' ');
  const glorysPath = points.map((p) => `${toX(p.glorysValue)},${toY(p.pressure)}`).join(' ');

  return (
    <div className="panel">
      <div className="panel-header">Vertical Profile</div>
      <div className="p-3">
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ maxWidth: '700px' }}>
          {Array.from({ length: 6 }, (_, i) => {
            const depth = (i / 5) * maxDepth;
            const y = toY(depth);
            return (
              <g key={i}>
                <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="#1e293b" strokeWidth="0.5" />
                <text x={padL - 5} y={y + 3} textAnchor="end" fill="#475569" fontSize="9">{depth.toFixed(0)}</text>
              </g>
            );
          })}
          {Array.from({ length: 5 }, (_, i) => {
            const val = minVal + (i / 4) * valRange;
            const x = toX(val);
            return (
              <g key={i}>
                <line x1={x} y1={padT} x2={x} y2={chartH - padB} stroke="#1e293b" strokeWidth="0.5" />
                <text x={x} y={chartH - padB + 12} textAnchor="middle" fill="#475569" fontSize="9">{val.toFixed(1)}</text>
              </g>
            );
          })}
          <polyline points={argoPath} fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="5 3" />
          <polyline points={glorysPath} fill="none" stroke="#a855f7" strokeWidth="1.5" />
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={toX(p.argoValue)} cy={toY(p.pressure)} r={2} fill="#22d3ee" />
              <circle cx={toX(p.glorysValue)} cy={toY(p.pressure)} r={2} fill="#a855f7" />
            </g>
          ))}
          {selectedMeasurement && (
            <line x1={padL} y1={toY(selectedMeasurement.pressure)} x2={chartW - padR} y2={toY(selectedMeasurement.pressure)} stroke="#d4a843" strokeWidth="1" strokeDasharray="3 2" />
          )}
          <line x1={padL + 8} y1={chartH - 6} x2={padL + 24} y2={chartH - 6} stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="5 3" />
          <text x={padL + 28} y={chartH - 3.5} fill="#94a3b8" fontSize="9">Argo</text>
          <line x1={padL + 68} y1={chartH - 6} x2={padL + 84} y2={chartH - 6} stroke="#a855f7" strokeWidth="1.5" />
          <text x={padL + 88} y={chartH - 3.5} fill="#94a3b8" fontSize="9">GLORYS</text>
          <text x={padL + plotW / 2} y={chartH - 18} textAnchor="middle" fill="#64748b" fontSize="9">{variable} ({unit})</text>
          <text x={12} y={padT + plotH / 2} textAnchor="middle" fill="#64748b" fontSize="9" transform={`rotate(-90, 12, ${padT + plotH / 2})`}>Depth (dbar)</text>
        </svg>
        {selectedMeasurement && (
          <p className="mt-2 text-[10px] mono" style={{ color: 'var(--os-selected)' }}>
            Selected: {selectedMeasurement.pressure.toFixed(1)} dbar
          </p>
        )}
      </div>
    </div>
  );
}

// ── Observations Table ───────────────────────────────────────────

function ObservationsTable({
  points,
  unit,
  selectedMeasurement,
}: {
  points: Research3DPoint[];
  unit: string;
  selectedMeasurement: Research3DPoint | null;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="panel-header">Observation Records ({points.length})</div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="text-left">Lat</th>
              <th className="text-left">Lon</th>
              <th className="text-right">Depth</th>
              <th className="text-right">Argo ({unit})</th>
              <th className="text-right">GLORYS ({unit})</th>
              <th className="text-right">Diff</th>
              <th className="text-left">Platform</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => {
              const isSelected = selectedMeasurement?.platformNumber === p.platformNumber
                && selectedMeasurement?.cycleNumber === p.cycleNumber
                && selectedMeasurement?.pressure === p.pressure;
              return (
                <tr
                  key={i}
                  className={isSelected ? 'selected-row' : ''}
                  style={isSelected ? { background: 'rgba(212, 168, 67, 0.08)' } : undefined}
                >
                  <td style={{ color: 'var(--os-text)' }}>{p.latitude.toFixed(2)}</td>
                  <td style={{ color: 'var(--os-text)' }}>{p.longitude.toFixed(2)}</td>
                  <td className="text-right mono" style={{ color: 'var(--os-text)' }}>{p.pressure.toFixed(1)}</td>
                  <td className="text-right mono" style={{ color: 'var(--os-argo)' }}>{p.argoValue.toFixed(2)}</td>
                  <td className="text-right mono" style={{ color: 'var(--os-glorys)' }}>{p.glorysValue.toFixed(2)}</td>
                  <td className="text-right mono" style={{ color: p.difference >= 0 ? 'var(--os-diff-pos)' : 'var(--os-diff-neg)' }}>
                    {p.difference > 0 ? '+' : ''}{p.difference.toFixed(4)}
                  </td>
                  <td style={{ color: 'var(--os-text-3)' }}>{p.platformNumber}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
