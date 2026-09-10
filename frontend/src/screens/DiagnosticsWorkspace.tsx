import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Database, Search, ShieldCheck } from 'lucide-react';
import { useOceanStore } from '@/state/oceanStore';
import { useResearchVisualization3D } from '@/integration';

const RESEARCH_DEPTH_MIN = 0;
const RESEARCH_DEPTH_MAX = 500;

export const DiagnosticsWorkspace: React.FC = () => {
  const {
    selectedLocation,
    selectedObservationId,
    selectedVariable,
    selectedDate,
    selectedTime,
    selectedDepth,
  } = useOceanStore();

  const {
    points,
    selectedProfilePoints,
    selectedMeasurement,
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

  const invalidValueCount = useMemo(
    () => selectedProfilePoints.filter((point) => (
      !Number.isFinite(point.pressure)
      || !Number.isFinite(point.argoValue)
      || !Number.isFinite(point.glorysValue)
      || !Number.isFinite(point.difference)
    )).length,
    [selectedProfilePoints],
  );
  const depthInWindow = selectedDepth >= RESEARCH_DEPTH_MIN && selectedDepth <= RESEARCH_DEPTH_MAX;
  const hasComparison = selectedProfilePoints.some((point) => (
    Number.isFinite(point.argoValue) && Number.isFinite(point.glorysValue)
  ));

  const issues = [
    !selectedLocation ? 'Select a real Argo observation to evaluate its collocated research profile.' : null,
    error ? error : null,
    !loading && selectedLocation && !error && points.length === 0
      ? 'No GLORYS × Argo collocation records are available for the current window.'
      : null,
    !loading && selectedObservationId && selectedProfilePoints.length === 0
      ? 'The selected observation has no matching profile in the current research response.'
      : null,
    !depthInWindow ? `Selected depth is outside the validated ${RESEARCH_DEPTH_MIN}–${RESEARCH_DEPTH_MAX} m research window.` : null,
    invalidValueCount > 0 ? `${invalidValueCount} selected profile record${invalidValueCount === 1 ? '' : 's'} contain non-finite values.` : null,
  ].filter((issue): issue is string => Boolean(issue));

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#060a12] font-sans text-slate-200">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#09101c] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-4 w-4 text-cyan-400" />
          <div>
            <h1 className="text-sm font-semibold text-slate-100">Data Quality &amp; Validation</h1>
            <p className="text-[11px] text-slate-500">GLORYS12V1 × Argo Delayed Mode · Bay of Bengal research workflow</p>
          </div>
        </div>
        <div className="font-mono text-[11px] text-slate-400">
          {selectedDate} · {selectedVariable} · {selectedDepth} m
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2">
          <section className="border border-slate-800 bg-[#09101d]">
            <SectionTitle icon={<Database className="h-4 w-4 text-cyan-400" />} title="Data availability" />
            <div className="divide-y divide-slate-800">
              <StatusRow
                label="Research selection"
                detail={selectedLocation
                  ? `${selectedLocation.latitude.toFixed(3)}°, ${selectedLocation.longitude.toFixed(3)}°${selectedObservationId ? ` · ${selectedObservationId}` : ''}`
                  : 'No collocated observation selected'}
                status={selectedLocation ? 'ready' : 'attention'}
              />
              <StatusRow
                label="Current research window"
                detail={loading ? 'Loading collocation response…' : error ? 'Response unavailable' : points.length > 0 ? `${points.length} collocation records returned${unit ? ` · ${unit}` : ''}` : 'No records returned'}
                status={loading ? 'pending' : error || points.length === 0 ? 'attention' : 'ready'}
              />
              <StatusRow
                label="Selected profile"
                detail={selectedObservationId ? `${selectedProfilePoints.length} matching depth records` : 'No observation selected'}
                status={selectedProfilePoints.length > 0 ? 'ready' : 'attention'}
              />
              <StatusRow
                label="Validated depth window"
                detail={`${RESEARCH_DEPTH_MIN}–${RESEARCH_DEPTH_MAX} m · selected ${selectedDepth} m`}
                status={depthInWindow ? 'ready' : 'attention'}
              />
            </div>
          </section>

          <section className="border border-slate-800 bg-[#09101d]">
            <SectionTitle icon={<Search className="h-4 w-4 text-cyan-400" />} title="Validation checks" />
            <div className="divide-y divide-slate-800">
              <StatusRow
                label="Model–observation comparison"
                detail={hasComparison ? 'Both GLORYS and Argo values are present in the selected profile.' : 'A valid paired comparison is not available.'}
                status={hasComparison ? 'ready' : 'attention'}
              />
              <StatusRow
                label="Selected depth record"
                detail={selectedMeasurement
                  ? `Nearest real record: ${selectedMeasurement.pressure.toFixed(1)} dbar`
                  : 'No real profile record is available for this selection'}
                status={selectedMeasurement ? 'ready' : 'attention'}
              />
              <StatusRow
                label="Value completeness"
                detail={selectedProfilePoints.length === 0
                  ? 'No selected profile to evaluate'
                  : invalidValueCount === 0 ? 'No non-finite values found in the selected profile.' : `${invalidValueCount} non-finite record${invalidValueCount === 1 ? '' : 's'} detected.`}
                status={selectedProfilePoints.length > 0 && invalidValueCount === 0 ? 'ready' : 'attention'}
              />
              <StatusRow
                label="Quality-control flags"
                detail="The current Research 3D response does not provide per-record QC flags."
                status="unavailable"
              />
            </div>
          </section>

          <section className="border border-slate-800 bg-[#09101d] lg:col-span-2">
            <SectionTitle icon={issues.length === 0 ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />} title="Issues" />
            <div className="p-4">
              {issues.length === 0 ? (
                <p className="text-sm text-slate-300">No data-quality issues detected for the current selection.</p>
              ) : (
                <ul className="space-y-2">
                  {issues.map((issue) => (
                    <li key={issue} className="flex gap-2 text-sm text-slate-300">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 border-t border-slate-800 pt-3 text-[11px] leading-relaxed text-slate-500">
                Diagnostics are limited to the active application selection and returned collocation data. No hardware telemetry, platform readiness, or unreported quality flags are inferred.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
      {icon}
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">{title}</h2>
    </div>
  );
}

function StatusRow({ label, detail, status }: { label: string; detail: string; status: 'ready' | 'attention' | 'pending' | 'unavailable' }) {
  const styles = {
    ready: { label: 'Available', color: 'text-emerald-400' },
    attention: { label: 'Review', color: 'text-amber-400' },
    pending: { label: 'Loading', color: 'text-cyan-400' },
    unavailable: { label: 'Not provided', color: 'text-slate-500' },
  }[status];

  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[12px] font-medium text-slate-200">{label}</div>
        <div className="mt-0.5 break-words font-mono text-[11px] text-slate-500">{detail}</div>
      </div>
      <span className={`shrink-0 text-[11px] ${styles.color}`}>{styles.label}</span>
    </div>
  );
}
