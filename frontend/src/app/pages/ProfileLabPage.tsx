import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useOceanStore } from '@/state/oceanStore';
import { useResearchVisualization3D, type Research3DPoint } from '@/integration';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { formatLatitude, formatLongitude } from '@/utils/coordinates';
import { observationDateLabel } from '@/config/observationDates';

const TEMPERATURE_UNIT = '°C';
const SALINITY_UNIT = 'PSU';

function parseObservationId(id: string): { platform: string; cycle: string } {
  const parts = id.split('_');
  return { platform: parts[1] ?? '', cycle: parts[2] ?? '' };
}

/**
 * Profile Lab — profile-level scientific evidence.
 *
 * Reads the shared investigation selection (a real Argo profile chosen on the
 * Globe) and renders its real collocated GLORYS × Argo depth records for both
 * temperature and salinity. Every value comes from the Research visualization
 * API — nothing is invented. With no selection the page shows an honest empty
 * state and explains how to pick a real observation in Explore.
 */
export function ProfileLabPage() {
  const {
    selectedLocation,
    selectedObservationId,
    selectedDate,
    selectedTime,
    selectedDepth,
    selectedVariable,
  } = useOceanStore();

  const hasObservation = selectedObservationId !== null && selectedLocation !== null;

  // The Research visualization endpoint returns the collocated point cloud for
  // the selected date; each request is variable-specific, so we fetch both
  // comparison variables and filter to the selected profile below.
  const temperature = useResearchVisualization3D({
    latitude: selectedLocation?.latitude ?? null,
    longitude: selectedLocation?.longitude ?? null,
    variable: 'temperature',
    date: selectedDate,
    time: selectedTime,
    selectedObservationId,
    selectedDepth,
    enabled: hasObservation,
  });

  const salinity = useResearchVisualization3D({
    latitude: selectedLocation?.latitude ?? null,
    longitude: selectedLocation?.longitude ?? null,
    variable: 'salinity',
    date: selectedDate,
    time: selectedTime,
    selectedObservationId,
    selectedDepth,
    enabled: hasObservation,
  });

  const identity = useMemo(
    () => (selectedObservationId ? parseObservationId(selectedObservationId) : { platform: '', cycle: '' }),
    [selectedObservationId],
  );

  const loading = hasObservation && (temperature.loading || salinity.loading);
  const error = hasObservation ? temperature.error || salinity.error : null;

  return (
    <PageContainer>
      <PageHeader
        title="Profile Lab"
        purpose="Profiles"
        description="Profile-level scientific evidence — vertical model–observation comparisons at the real collocated position of a selected Argo profile."
        breadcrumb={<Link to="/" className="text-[11px]" style={{ color: 'var(--os-text-3)' }}>← Workspace Home</Link>}
        actions={
          <Link
            to="/explore"
            className="rounded-sm border px-3 py-1.5 text-[11px] font-semibold transition"
            style={{ borderColor: 'var(--os-border-light)', color: 'var(--os-accent)', background: 'var(--os-bg)' }}
          >
            Select Observation
          </Link>
        }
      />

      {!hasObservation && (
        <SectionCard title="No profile selected">
          <div className="py-6 text-center">
            <p className="mx-auto max-w-md text-[12px] leading-relaxed" style={{ color: 'var(--os-text-2)' }}>
              Select a real Argo observation on the Globe to open its collocated
              GLORYS12V1 profile here. Only actual observation markers from the
              collocation dataset are selectable — arbitrary globe clicks are
              navigation only and never become scientific observations.
            </p>
            <div className="mt-4">
              <Link
                to="/explore"
                className="rounded-sm px-4 py-1.5 text-[12px] font-semibold transition"
                style={{ background: 'var(--os-accent)', color: '#fff', border: '1px solid var(--os-accent)' }}
              >
                Open Explore
              </Link>
            </div>
          </div>
        </SectionCard>
      )}

      {hasObservation && (
        <>
          {/* Profile identity + provenance */}
          <SectionCard className="mb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mono text-[16px] font-semibold" style={{ color: 'var(--os-argo)' }}>
                  ARGO {identity.platform}
                </div>
                <div className="mt-0.5 text-[11px]" style={{ color: 'var(--os-text-2)' }}>
                  Cycle {identity.cycle} · real Argo profile · observed {observationDateLabel(selectedDate)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge label="Real profile" tone="available" />
                <span className="mono text-[10px]" style={{ color: 'var(--os-text-3)' }}>
                  {selectedLocation ? `${formatLatitude(selectedLocation.latitude)} · ${formatLongitude(selectedLocation.longitude)}` : '—'}
                </span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-[var(--os-border)] pt-3 sm:grid-cols-4">
              <MetaCell label="Observation date" value={selectedDate} mono />
              <MetaCell label="Variable context" value={selectedVariable} mono />
              <MetaCell label="Requested depth" value={`${selectedDepth} m`} mono />
              <MetaCell label="Convention" value="GLORYS − Argo" mono />
            </div>
            <div className="mt-3 border-t border-[var(--os-border)] pt-2">
              <div className="text-[10px] leading-relaxed" style={{ color: 'var(--os-text-3)' }}>
                Collocation: GLORYS12V1 × Argo Delayed Mode · Bay of Bengal · 0.25° spatial match ·
                daily nearest-neighbour temporal match · pressure range 0.50–445.06 dbar ·
                positive difference = model higher than observation.
              </div>
            </div>
          </SectionCard>

          {loading && (
            <SectionCard title="Profile records">
              <LoadingState message="Loading collocated profile records from the Research API…" />
            </SectionCard>
          )}
          {!loading && error && (
            <SectionCard title="Profile records">
              <ErrorState message={error} />
            </SectionCard>
          )}

          {!loading && !error && (
            <>
              <VariableProfileSection
                title="Temperature profile"
                unit={TEMPERATURE_UNIT}
                points={temperature.selectedProfilePoints}
                selectedDepth={selectedDepth}
                accent="var(--os-diff-pos)"
              />
              <VariableProfileSection
                title="Salinity profile"
                unit={SALINITY_UNIT}
                points={salinity.selectedProfilePoints}
                selectedDepth={selectedDepth}
                accent="var(--os-diff-neg)"
              />
            </>
          )}
        </>
      )}
    </PageContainer>
  );
}

// ── Temperature / salinity profile section ────────────────────────────────────

function VariableProfileSection({
  title,
  unit,
  points,
  selectedDepth,
  accent,
}: {
  title: string;
  unit: string;
  points: Research3DPoint[];
  selectedDepth: number;
  accent: string;
}) {
  if (points.length === 0) {
    return (
      <SectionCard title={title} className="mb-4">
        <EmptyState message={`No real collocated ${title.toLowerCase()} records for this profile.`} />
      </SectionCard>
    );
  }

  const sorted = [...points].sort((a, b) => a.pressure - b.pressure);
  const nearest = findNearestPressure(sorted, selectedDepth);

  return (
    <SectionCard title={title} className="mb-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
        <ProfilePlot points={sorted} unit={unit} accent={accent} selectedPressure={nearest?.pressure ?? null} />
        <div className="panel overflow-hidden self-start">
          <div className="panel-header">Observation records ({points.length})</div>
          <div className="max-h-72 overflow-y-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="text-left">Depth</th>
                  <th className="text-right">Argo</th>
                  <th className="text-right">GLORYS</th>
                  <th className="text-right">Δ</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => {
                  const isNearest = nearest !== null && Math.abs(p.pressure - nearest.pressure) < 1e-6;
                  return (
                    <tr key={i} className={isNearest ? 'selected-row' : ''} style={isNearest ? { background: 'rgba(212, 168, 67, 0.08)' } : undefined}>
                      <td className="mono">{p.pressure.toFixed(1)} dbar</td>
                      <td className="mono text-right" style={{ color: 'var(--os-argo)' }}>{p.argoValue.toFixed(3)}</td>
                      <td className="mono text-right" style={{ color: 'var(--os-glorys)' }}>{p.glorysValue.toFixed(3)}</td>
                      <td className="mono text-right" style={{ color: p.difference >= 0 ? 'var(--os-diff-pos)' : 'var(--os-diff-neg)' }}>
                        {p.difference > 0 ? '+' : ''}{p.difference.toFixed(3)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {nearest && (
        <p className="mt-2 text-[10px]" style={{ color: 'var(--os-selected)' }}>
          Nearest real record to requested {selectedDepth} m: {nearest.pressure.toFixed(1)} dbar ·
          Argo {nearest.argoValue.toFixed(3)} {unit} · GLORYS {nearest.glorysValue.toFixed(3)} {unit} ·
          Δ {nearest.difference > 0 ? '+' : ''}{nearest.difference.toFixed(3)} {unit}
        </p>
      )}
    </SectionCard>
  );
}

function findNearestPressure(points: Research3DPoint[], target: number): Research3DPoint | null {
  if (points.length === 0) return null;
  let nearest = points[0];
  let best = Math.abs(points[0].pressure - target);
  for (const p of points) {
    const d = Math.abs(p.pressure - target);
    if (d < best) {
      best = d;
      nearest = p;
    }
  }
  return nearest;
}

// ── Compact vertical profile plot (SVG) ───────────────────────────────────────

function ProfilePlot({
  points,
  unit,
  accent,
  selectedPressure,
}: {
  points: Research3DPoint[];
  unit: string;
  accent: string;
  selectedPressure: number | null;
}) {
  const allVals = points.flatMap((p) => [p.glorysValue, p.argoValue]);
  const minVal = Math.min(...allVals);
  const maxVal = Math.max(...allVals);
  const maxDepth = Math.max(...points.map((p) => p.pressure));
  const valRange = maxVal - minVal || 1;

  const chartW = 560;
  const chartH = 300;
  const padL = 48;
  const padR = 18;
  const padT = 14;
  const padB = 36;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const toX = (val: number) => padL + ((val - minVal) / valRange) * plotW;
  const toY = (depth: number) => padT + (depth / (maxDepth || 1)) * plotH;

  const argoPath = points.map((p) => `${toX(p.argoValue)},${toY(p.pressure)}`).join(' ');
  const glorysPath = points.map((p) => `${toX(p.glorysValue)},${toY(p.pressure)}`).join(' ');

  return (
    <div className="min-w-0 border border-[var(--os-border)] bg-[var(--os-bg)] p-2">
      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="block h-auto w-full">
        {/* Depth gridlines */}
        {Array.from({ length: 6 }, (_, i) => {
          const depth = (i / 5) * maxDepth;
          const y = toY(depth);
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={chartW - padR} y2={y} stroke="var(--os-border)" strokeWidth="0.5" />
              <text x={padL - 5} y={y + 3} textAnchor="end" fill="var(--os-text-3)" fontSize="9">{depth.toFixed(0)}</text>
            </g>
          );
        })}
        {/* Value gridlines */}
        {Array.from({ length: 5 }, (_, i) => {
          const val = minVal + (i / 4) * valRange;
          const x = toX(val);
          return (
            <g key={i}>
              <line x1={x} y1={padT} x2={x} y2={chartH - padB} stroke="var(--os-border)" strokeWidth="0.5" />
              <text x={x} y={chartH - padB + 12} textAnchor="middle" fill="var(--os-text-3)" fontSize="9">{val.toFixed(1)}</text>
            </g>
          );
        })}
        <polyline points={argoPath} fill="none" stroke="var(--os-argo)" strokeWidth="1.5" strokeDasharray="5 3" />
        <polyline points={glorysPath} fill="none" stroke={accent} strokeWidth="1.5" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={toX(p.argoValue)} cy={toY(p.pressure)} r={2} fill="var(--os-argo)" />
            <circle cx={toX(p.glorysValue)} cy={toY(p.pressure)} r={2} fill={accent} />
          </g>
        ))}
        {selectedPressure !== null && (
          <line x1={padL} y1={toY(selectedPressure)} x2={chartW - padR} y2={toY(selectedPressure)} stroke="var(--os-selected)" strokeWidth="1" strokeDasharray="3 2" />
        )}
        <line x1={padL + 8} y1={chartH - 5} x2={padL + 22} y2={chartH - 5} stroke="var(--os-argo)" strokeWidth="1.5" strokeDasharray="5 3" />
        <text x={padL + 26} y={chartH - 2.5} fill="var(--os-text-3)" fontSize="9">Argo</text>
        <line x1={padL + 64} y1={chartH - 5} x2={padL + 78} y2={chartH - 5} stroke={accent} strokeWidth="1.5" />
        <text x={padL + 82} y={chartH - 2.5} fill="var(--os-text-3)" fontSize="9">GLORYS12V1</text>
        <text x={padL + plotW / 2} y={chartH - 16} textAnchor="middle" fill="var(--os-text-3)" fontSize="9">
          Value ({unit}) · depth in dbar ↓
        </text>
      </svg>
      <p className="mt-1 text-[10px]" style={{ color: 'var(--os-text-3)' }}>
        {points.length} real collocated records · {new Set(points.map((p) => p.pressure.toFixed(1))).size} unique depth levels
      </p>
    </div>
  );
}

function MetaCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.08em]" style={{ color: 'var(--os-text-muted)' }}>{label}</div>
      <div className={`mt-0.5 text-[12px] font-medium ${mono ? 'mono' : ''}`} style={{ color: 'var(--os-text)' }}>{value}</div>
    </div>
  );
}