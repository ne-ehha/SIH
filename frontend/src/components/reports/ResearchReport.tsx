import { useEffect, useState, type ReactNode } from 'react';
import { useOceanStore } from '@/state/oceanStore';
import { getProvider, useResearchVisualization3D } from '@/integration';

interface ReportData {
  comparison: {
    modelValue: number;
    observationValue: number;
    difference: number;
    unit: string;
    sourceModel: string;
    sourceObservation: string;
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

  const { stats: validationStats, selectedMeasurement, unit } = useResearchVisualization3D({
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
        const [comparisonResponse, profileResponse] = await Promise.all([
          provider.fetchComparison({
            location: { ...selectedLocation, depth: selectedDepth },
            variable: selectedVariable,
            depth: selectedDepth,
            date: selectedDate,
            time: selectedTime,
          }),
          provider.fetchVerticalProfile({
            location: selectedLocation,
            variable: selectedVariable,
            date: selectedDate,
            time: selectedTime,
          }),
        ]);

        const comparison = comparisonResponse.status === 'success' && comparisonResponse.data
          ? {
              modelValue: comparisonResponse.data.point.modelValue,
              observationValue: comparisonResponse.data.point.observationValue,
              difference: comparisonResponse.data.point.difference,
              unit: comparisonResponse.data.point.unit,
              sourceModel: comparisonResponse.data.sourceModel,
              sourceObservation: comparisonResponse.data.sourceObservation,
              nearestDistance: comparisonResponse.data.nearestDistance,
            }
          : null;
        const profilePointCount = profileResponse.status === 'success' && profileResponse.data
          ? profileResponse.data.points.length
          : 0;
        const maxDepth = profileResponse.status === 'success' && profileResponse.data
          ? profileResponse.data.maxDepth
          : 0;

        setReport({ comparison, profilePointCount, maxDepth });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Failed to load report data');
      } finally {
        setLoading(false);
      }
    };

    void fetchReport();
  }, [selectedLocation, selectedVariable, selectedDate, selectedTime, selectedDepth]);

  if (!selectedLocation) return <ReportMessage title="No observation selected" detail="Select a real Argo profile from Explore to generate a research report." />;
  if (loading) return <ReportMessage title="Generating report" detail="Retrieving current comparison and profile evidence." />;
  if (error) return <ReportMessage title="Report data unavailable" detail={error} />;
  if (!report) return <ReportMessage title="No report data available" detail="No report data are available for this selection." />;

  const evidence = selectedMeasurement || (report.comparison ? {
    argoValue: report.comparison.observationValue,
    glorysValue: report.comparison.modelValue,
    difference: report.comparison.difference,
    pressure: selectedDepth,
  } : null);
  const evidenceUnit = unit || report.comparison?.unit || '';
  const formatDifference = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}`;

  return (
    <article className="mx-auto max-w-4xl space-y-4">
      <header className="border-b pb-4" style={{ borderColor: 'var(--os-border)' }}>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--os-text)' }}>Research report</h2>
        <p className="mt-1 text-[12px] leading-relaxed" style={{ color: 'var(--os-text-2)' }}>
          Current GLORYS12V1 and Argo Delayed Mode comparison for the active research selection.
        </p>
      </header>

      <Section title="Study scope">
        <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2">
          <Row label="Region" value="Bay of Bengal" />
          <Row label="Analysis period" value="2024-01-01 to 2024-01-15" />
          <Row label="Model" value="GLORYS12V1" />
          <Row label="Observations" value="Argo Delayed Mode" />
          <Row label="Validated depth range" value="0–500 m" />
          <Row label="Difference definition" value="GLORYS12V1 − Argo" />
        </div>
      </Section>

      <Section title="Selected comparison">
        <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2">
          <Row label="Variable" value={selectedVariable} />
          <Row label="Requested depth" value={`${selectedDepth} m`} />
          <Row label="Selected date" value={selectedDate} />
          <Row label="Selected observation" value={selectedObservationId ?? 'No profile identity selected'} />
          {selectedLocation && <Row label="Location" value={`${selectedLocation.latitude.toFixed(2)}°, ${selectedLocation.longitude.toFixed(2)}°`} />}
        </div>
      </Section>

      <Section title="Observed comparison">
        {evidence ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Value label="Observation value" value={evidence.argoValue.toFixed(2)} unit={evidenceUnit} color="var(--os-argo)" />
              <Value label="Model value" value={evidence.glorysValue.toFixed(2)} unit={evidenceUnit} color="var(--os-glorys)" />
              <Value label="Observed difference" value={formatDifference(evidence.difference)} unit={evidenceUnit} color={evidence.difference >= 0 ? 'var(--os-diff-pos)' : 'var(--os-diff-neg)'} />
            </div>
            <p className="mt-3 border-t pt-3 text-[11px]" style={{ borderColor: 'var(--os-border)', color: 'var(--os-text-3)' }}>
              Nearest real profile measurement: <span className="mono" style={{ color: 'var(--os-text-2)' }}>{evidence.pressure.toFixed(1)} dbar</span>
              {report.comparison?.nearestDistance !== undefined && report.comparison.nearestDistance > 0.01 && ` · ${report.comparison.nearestDistance.toFixed(1)} km from the requested location`}
            </p>
          </>
        ) : <p className="text-[12px]" style={{ color: 'var(--os-text-3)' }}>No model–observation evidence is available for this selection.</p>}
      </Section>

      <Section title="Validation results">
        {validationStats ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Value label="Collocated records" value={String(validationStats.totalPoints)} />
              <Value label="Mean difference" value={formatDifference(validationStats.meanDifference)} unit={unit} color={validationStats.meanDifference >= 0 ? 'var(--os-diff-pos)' : 'var(--os-diff-neg)'} />
              <Value label="RMS difference" value={validationStats.rmsDifference.toFixed(2)} unit={unit} />
              <Value label="Argo mean" value={validationStats.argoMean.toFixed(2)} unit={unit} color="var(--os-argo)" />
              <Value label="GLORYS mean" value={validationStats.glorysMean.toFixed(2)} unit={unit} color="var(--os-glorys)" />
              <Value label="Maximum |difference|" value={validationStats.maxDifference.toFixed(2)} unit={unit} />
            </div>
            <p className="mt-3 text-[11px]" style={{ color: 'var(--os-text-3)' }}>
              Returned depth range: {validationStats.depthRange[0]}–{validationStats.depthRange[1]} dbar.
            </p>
          </>
        ) : <p className="text-[12px]" style={{ color: 'var(--os-text-3)' }}>Validation statistics are unavailable for this selection.</p>}
      </Section>

      <Section title="Evidence context">
        <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2">
          <Row label="Comparison model source" value={report.comparison?.sourceModel ?? 'Unavailable'} />
          <Row label="Observation source" value={report.comparison?.sourceObservation ?? 'Unavailable'} />
          <Row label="Returned profile levels" value={String(report.profilePointCount)} />
          <Row label="Returned profile maximum depth" value={report.maxDepth > 0 ? `${report.maxDepth.toFixed(1)} dbar` : 'Unavailable'} />
        </div>
      </Section>

      <Section title="Dataset scope">
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--os-text-2)' }}>
          This report presents the Bay of Bengal GLORYS12V1 × Argo Delayed Mode research comparison for 1–15 January 2024, within the validated 0–500 m water-column window. Differences are calculated as GLORYS12V1 minus Argo.
        </p>
      </Section>
    </article>
  );
}

function ReportMessage({ title, detail }: { title: string; detail: string }) {
  return <div className="flex min-h-48 items-center justify-center text-center"><div><p className="text-[13px] font-medium" style={{ color: 'var(--os-text-2)' }}>{title}</p><p className="mt-1 text-[11px]" style={{ color: 'var(--os-text-3)' }}>{detail}</p></div></div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="border" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}><h3 className="border-b px-4 py-2.5 text-[13px] font-semibold" style={{ borderColor: 'var(--os-border)', color: 'var(--os-text)' }}>{title}</h3><div className="p-4">{children}</div></section>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex min-w-0 items-baseline justify-between gap-4 py-0.5 text-[12px]"><span style={{ color: 'var(--os-text-muted)' }}>{label}</span><span className="mono min-w-0 break-words text-right" style={{ color: 'var(--os-text-2)' }}>{value}</span></div>;
}

function Value({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return <div><div className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--os-text-muted)' }}>{label}</div><div className="mono mt-1 text-[16px] font-semibold" style={{ color: color ?? 'var(--os-text)' }}>{value}{unit && <span className="ml-1 text-[11px] font-normal" style={{ color: 'var(--os-text-3)' }}>{unit}</span>}</div></div>;
}
