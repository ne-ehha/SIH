import { useState, useEffect } from 'react';
import { useOceanStore } from '@/state/oceanStore';
import { getProvider } from '@/integration';
import { useResearchVisualization3D } from '@/integration';

interface ReportData {
  comparison: {
    modelValue: number;
    observationValue: number;
    difference: number;
    unit: string;
    sourceModel: string;
    sourceObservation: string;
    observationLatitude?: number;
    observationLongitude?: number;
    nearestDistance?: number;
  } | null;
  profilePointCount: number;
  maxDepth: number;
}

export function ResearchReport() {
  const {
    selectedLocation,
    selectedVariable,
    selectedDate,
    selectedTime,
    selectedDepth,
    selectedObservationId,
  } = useOceanStore();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { stats: vizStats, selectedMeasurement, unit } = useResearchVisualization3D({
    latitude: selectedLocation?.latitude ?? null,
    longitude: selectedLocation?.longitude ?? null,
    variable: selectedVariable,
    date: selectedDate,
    time: selectedTime,
    selectedObservationId,
    selectedDepth,
  });

  useEffect(() => {
    if (!selectedLocation) return;

    const fetchReport = async () => {
      setLoading(true);
      setError(null);
      try {
        const provider = getProvider();

        const compResponse = await provider.fetchComparison({
          location: {
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
            depth: selectedDepth,
          },
          variable: selectedVariable,
          depth: selectedDepth,
          date: selectedDate,
          time: selectedTime,
        });

        const profResponse = await provider.fetchVerticalProfile({
          location: {
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
          },
          variable: selectedVariable,
          date: selectedDate,
          time: selectedTime,
        });

        let comparison = null;
        if (compResponse.status === 'success' && compResponse.data) {
          const d = compResponse.data;
          comparison = {
            modelValue: d.point.modelValue,
            observationValue: d.point.observationValue,
            difference: d.point.difference,
            unit: d.point.unit,
            sourceModel: d.sourceModel,
            sourceObservation: d.sourceObservation,
            observationLatitude: d.observationLatitude,
            observationLongitude: d.observationLongitude,
            nearestDistance: d.nearestDistance,
          };
        }

        let profilePointCount = 0;
        let maxDepth = 0;
        if (profResponse.status === 'success' && profResponse.data) {
          profilePointCount = profResponse.data.points.length;
          maxDepth = profResponse.data.maxDepth;
        }

        setReport({ comparison, profilePointCount, maxDepth });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load report data');
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [selectedLocation, selectedVariable, selectedDate, selectedTime, selectedDepth]);

  if (!selectedLocation) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="text-center">
          <p className="text-[13px] font-medium" style={{ color: 'var(--os-text-2)' }}>
            No observation selected
          </p>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--os-text-3)' }}>
            Select a real Argo profile from the Globe to generate a research report.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex flex-col items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-t-transparent" style={{ borderColor: 'var(--os-argo)', borderTopColor: 'transparent' }} />
          <p className="text-[11px]" style={{ color: 'var(--os-text-3)' }}>Generating report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-[11px]" style={{ color: '#ef4444' }}>{error}</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="text-center">
          <p className="text-[13px] font-medium" style={{ color: 'var(--os-text-2)' }}>
            No report data available
          </p>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--os-text-3)' }}>
            No report data available for this selection.
          </p>
        </div>
      </div>
    );
  }

  // Use the hook's selectedMeasurement as primary, with API comparison as fallback
  const evidence = selectedMeasurement || (report.comparison ? {
    argoValue: report.comparison.observationValue,
    glorysValue: report.comparison.modelValue,
    difference: report.comparison.difference,
    pressure: selectedDepth,
  } : null);
  const evidenceUnit = unit || report.comparison?.unit || '';

  // Helper: format difference with explicit sign prefix
  const fmtDiff = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`;

  return (
    <div className="space-y-4 max-w-4xl">
      {/* ── Report Header ────────────────────────────────── */}
      <div className="border-b pb-3" style={{ borderColor: 'var(--os-border)' }}>
        <div className="flex items-center gap-3 mb-1.5">
          <span className="text-[15px] font-bold uppercase tracking-wider" style={{ color: 'var(--os-text)' }}>
            Report
          </span>
          <span style={{ color: 'var(--os-text-3)' }}>·</span>
          <span className="text-[15px] font-bold uppercase tracking-wider" style={{ color: 'var(--os-argo)' }}>
            Communicate
          </span>
        </div>
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--os-text-2)' }}>
          Evidence-backed summary of the current GLORYS12V1 × Argo research comparison
          {selectedObservationId && (
            <span className="mono ml-2" style={{ color: 'var(--os-argo)' }}>
              {selectedObservationId.replace('argo_', 'ARGO ').replace('_', ' · Cycle ')}
            </span>
          )}
        </p>
      </div>

      {/* ── 1. Investigation Scope ───────────────────────── */}
      <Section title="Investigation Scope">
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
          <ScopeRow label="Comparison" value="GLORYS12V1 × Argo Delayed Mode" />
          <ScopeRow label="Region" value="Bay of Bengal" />
          <ScopeRow label="Period" value="2024-01-01 through 2024-01-15" />
          <ScopeRow label="Validated Depth" value="0–500 m" />
          <ScopeRow label="Variable" value={selectedVariable} />
          <ScopeRow label="Date" value={selectedDate} />
          <ScopeRow label="Difference" value="GLORYS − Argo (positive = model higher)" />
        </div>
      </Section>

      {/* ── 2. Selected Profile ──────────────────────────── */}
      {selectedObservationId && (
        <Section title="Selected Profile">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
            <ScopeRow label="Platform" value={selectedObservationId.replace('argo_', '').split('_')[0]} />
            <ScopeRow label="Cycle" value={selectedObservationId.split('_')[2] || '—'} />
            <ScopeRow
              label="Location"
              value={selectedLocation
                ? `${selectedLocation.latitude.toFixed(2)}° ${selectedLocation.latitude >= 0 ? 'N' : 'S'}, ${selectedLocation.longitude.toFixed(2)}° ${selectedLocation.longitude >= 0 ? 'E' : 'W'}`
                : '—'}
            />
            <ScopeRow label="Date" value={selectedDate} />
          </div>
        </Section>
      )}

      {/* ── 3. Model–Observation Evidence ────────────────── */}
      {evidence ? (
        <Section title="Model–Observation Evidence">
          <div className="flex items-start gap-10">
            {/* Argo */}
            <div>
              <div className="report-sci-label" style={{ color: 'var(--os-argo)' }}>Argo</div>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="report-sci-value" style={{ color: 'var(--os-argo)' }}>
                  {evidence.argoValue.toFixed(2)}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--os-text-3)' }}>{evidenceUnit}</span>
              </div>
            </div>

            {/* GLORYS */}
            <div>
              <div className="report-sci-label" style={{ color: 'var(--os-glorys)' }}>GLORYS12V1</div>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="report-sci-value" style={{ color: 'var(--os-glorys)' }}>
                  {evidence.glorysValue.toFixed(2)}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--os-text-3)' }}>{evidenceUnit}</span>
              </div>
            </div>

            {/* Difference */}
            <div>
              <div className="report-sci-label">GLORYS − Argo</div>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span
                  className="report-sci-value"
                  style={{ color: evidence.difference >= 0 ? 'var(--os-diff-pos)' : 'var(--os-diff-neg)' }}
                >
                  {fmtDiff(evidence.difference)}
                </span>
                <span className="text-[11px]" style={{ color: 'var(--os-text-3)' }}>{evidenceUnit}</span>
                <span
                  className="report-diff-badge"
                  style={{ color: evidence.difference >= 0 ? 'var(--os-diff-pos)' : 'var(--os-diff-neg)' }}
                >
                  {evidence.difference >= 0 ? 'MODEL HIGH' : 'MODEL LOW'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-2 border-t pt-2" style={{ borderColor: 'var(--os-border)' }}>
            <p className="text-[11px]" style={{ color: 'var(--os-text-3)' }}>
              Compared at <span className="mono" style={{ color: 'var(--os-text-2)' }}>{evidence.pressure.toFixed(0)} m</span>
              {report.comparison?.nearestDistance !== undefined && report.comparison.nearestDistance > 0.01 && (
                <span> · Matched observation {report.comparison.nearestDistance.toFixed(1)} km from requested location</span>
              )}
            </p>
          </div>
        </Section>
      ) : (
        <Section title="Model–Observation Evidence">
          <p className="text-[12px]" style={{ color: 'var(--os-text-3)' }}>
            No comparison data available for this selection.
          </p>
        </Section>
      )}

      {/* ── 4. All-Depth Validation ──────────────────────── */}
      {vizStats && (
        <Section title="All-Depth Validation">
          <p className="text-[11px] mb-2.5" style={{ color: 'var(--os-text-3)' }}>
            Collocated profiles at this location · all validated depths · {selectedDate}
          </p>

          <div className="grid grid-cols-3 gap-4">
            <StatBlock
              label="Valid Comparisons"
              value={String(vizStats.totalPoints)}
            />
            <StatBlock
              label="Mean Δ"
              value={`${fmtDiff(vizStats.meanDifference)} ${unit}`}
              color={vizStats.meanDifference >= 0 ? 'var(--os-diff-pos)' : 'var(--os-diff-neg)'}
            />
            <StatBlock
              label="RMS"
              value={`${vizStats.rmsDifference.toFixed(2)} ${unit}`}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 mt-2.5 pt-2.5 border-t" style={{ borderColor: 'var(--os-border)' }}>
            <StatBlock
              label="Argo Mean"
              value={`${vizStats.argoMean.toFixed(2)} ${unit}`}
              color="var(--os-argo)"
            />
            <StatBlock
              label="GLORYS Mean"
              value={`${vizStats.glorysMean.toFixed(2)} ${unit}`}
              color="var(--os-glorys)"
            />
            <StatBlock
              label="Max |Δ|"
              value={`${vizStats.maxDifference.toFixed(2)} ${unit}`}
            />
          </div>

          <p className="mt-2.5 text-[10px]" style={{ color: 'var(--os-text-muted)' }}>
            Depth range: {vizStats.depthRange[0]}–{vizStats.depthRange[1]} dbar · Source: GLORYS12V1 × Argo Delayed Mode
          </p>
        </Section>
      )}

      {/* ── 5. Depth Context ─────────────────────────────── */}
      <Section title="Depth Context">
        <div className="flex items-baseline gap-6 text-[12px]">
          <div>
            <span style={{ color: 'var(--os-text-muted)' }}>Selected depth: </span>
            <span className="mono" style={{ color: 'var(--os-text)' }}>{selectedDepth} m</span>
          </div>
          <div>
            <span style={{ color: 'var(--os-text-muted)' }}>Profile levels: </span>
            <span className="mono" style={{ color: 'var(--os-text)' }}>{report.profilePointCount}</span>
          </div>
          <div>
            <span style={{ color: 'var(--os-text-muted)' }}>Max depth: </span>
            <span className="mono" style={{ color: 'var(--os-text)' }}>{report.maxDepth.toFixed(0)} dbar</span>
          </div>
          <div>
            <span style={{ color: 'var(--os-text-muted)' }}>Validated window: </span>
            <span className="mono" style={{ color: 'var(--os-text)' }}>0–500 m</span>
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: 'var(--os-text-3)' }}>
          The validated comparison window is 0–500 m. Detailed depth-by-depth model–observation
          behaviour is available in the Research 3D workspace.
        </p>
      </Section>

      {/* ── 6. Limitations / Integrity ───────────────────── */}
      <Section title="Limitations & Integrity">
        <ul className="space-y-1 text-[11px] leading-relaxed" style={{ color: 'var(--os-text-3)' }}>
          <li className="flex gap-2">
            <span className="shrink-0" style={{ color: 'var(--os-text-muted)' }}>•</span>
            <span>Validated comparison window is 0–500 m depth.</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0" style={{ color: 'var(--os-text-muted)' }}>•</span>
            <span>All-depth statistics cover validated depths for {selectedDate} at this collocation.</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0" style={{ color: 'var(--os-text-muted)' }}>•</span>
            <span>Spatial match uses 0.25° grid; temporal match uses daily nearest.</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0" style={{ color: 'var(--os-text-muted)' }}>•</span>
            <span>Differences represent GLORYS model output minus Argo observation values.</span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0" style={{ color: 'var(--os-text-muted)' }}>•</span>
            <span>Scientific conclusions should be validated against additional independent data sources.</span>
          </li>
        </ul>
      </Section>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <div className="panel-header">{title}</div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

function ScopeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[12px] py-0.5">
      <span style={{ color: 'var(--os-text-muted)' }}>{label}</span>
      <span className="mono" style={{ color: 'var(--os-text-2)' }}>{value}</span>
    </div>
  );
}

function StatBlock({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--os-text-muted)' }}>{label}</div>
      <div
        className="mt-0.5 text-[15px] font-semibold mono"
        style={{ color: color || 'var(--os-text)' }}
      >
        {value}
      </div>
    </div>
  );
}
