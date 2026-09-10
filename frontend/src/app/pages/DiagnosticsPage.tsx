import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useOceanStore } from '@/state/oceanStore';
import { runDiagnostics, getWorkflowSteps, getRecommendations } from '@/services/diagnosticsService';
import type { DiagnosticResult, WorkflowStep, SolutionRecommendation } from '@/types/diagnostics';
import { PageContainer } from '@/components/common/PageContainer';
import { PageHeader } from '@/components/common/PageHeader';
import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { DatasetFindings } from '@/components/diagnostics/DatasetFindings';
import { formatLatitude, formatLongitude } from '@/utils/coordinates';

// Module-level cache keyed by investigation state, mirroring SolutionsPanel:
// avoids re-running the backend diagnostics for the same location/variable/depth/date.
const diagnosticCache = new Map<
  string,
  { diagnostic: DiagnosticResult; steps: WorkflowStep[]; solution: SolutionRecommendation | null }
>();

function cacheKey(loc: { latitude: number; longitude: number } | null, variable: string, depth: number, date: string): string {
  if (!loc) return '';
  return `${loc.latitude.toFixed(4)}|${loc.longitude.toFixed(4)}|${variable}|${depth}|${date}`;
}

/**
 * Diagnostics — investigation workspace.
 *
 * Surfaces two distinct layers:
 *  1. Observed evidence — the dataset-level verified findings (real statistics).
 *  2. Location diagnostics — output of the backend diagnostics API for the
 *     selected collocated position. Candidate explanations are explicitly
 *     labelled as hypotheses (investigation pathways), never proven causes.
 */
export function DiagnosticsPage() {
  const { selectedLocation, selectedVariable, selectedDepth, selectedDate } = useOceanStore();
  const hasSelection = selectedLocation !== null;

  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [solution, setSolution] = useState<SolutionRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDiagnostics = async () => {
    if (!selectedLocation) return;

    const key = cacheKey(selectedLocation, selectedVariable, selectedDepth, selectedDate);
    const cached = diagnosticCache.get(key);
    if (cached) {
      setDiagnostic(cached.diagnostic);
      setSteps(cached.steps);
      setSolution(cached.solution);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const diag = await runDiagnostics(selectedLocation, selectedVariable, selectedDepth);
      const [stepsResult, solutionResult] = await Promise.all([
        getWorkflowSteps(diag.id),
        getRecommendations(diag.id),
      ]);
      const entry = { diagnostic: diag, steps: stepsResult, solution: solutionResult };
      diagnosticCache.set(key, entry);
      setDiagnostic(diag);
      setSteps(stepsResult);
      setSolution(solutionResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Diagnostic evidence could not be retrieved.');
      setDiagnostic(null);
      setSteps([]);
      setSolution(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLocation) {
      void loadDiagnostics();
    } else {
      setDiagnostic(null);
      setSteps([]);
      setSolution(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation, selectedVariable, selectedDepth, selectedDate]);

  return (
    <PageContainer>
      <PageHeader
        title="Diagnostics"
        purpose="Investigate"
        description="Root-cause investigation that separates observed facts from candidate hypotheses. Dataset-level evidence is verified; location diagnostics come from the live diagnostics API."
        breadcrumb={<Link to="/" className="text-[11px]" style={{ color: 'var(--os-text-3)' }}>← Workspace Home</Link>}
        actions={<StatusBadge label="Observed evidence" tone="available" />}
      />

      {/* ── Observed evidence — verified dataset statistics ── */}
      <SectionCard title="Observed evidence — dataset level" className="mb-5">
        <DatasetFindings />
      </SectionCard>

      {/* ── Location diagnostics — live API ── */}
      <SectionCard title="Location diagnostics" className="mb-5">
        {!hasSelection && (
          <div className="py-6 text-center">
            <p className="mx-auto max-w-md text-[12px] leading-relaxed" style={{ color: 'var(--os-text-2)' }}>
              Select a real Argo observation on the Globe to run the location-level
              diagnostics API at its collocated position. The diagnostics analyse
              nearby GLORYS12V1 × Argo collocations and return a fingerprint,
              evidence, and candidate explanations — all hypotheses, not proven causes.
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
        )}

        {hasSelection && loading && <LoadingState message="Running diagnostics API for this location…" />}
        {hasSelection && !loading && error && <ErrorState message={error} onRetry={() => void loadDiagnostics()} />}

        {hasSelection && !loading && !error && diagnostic && (
          <div className="space-y-5">
            {/* Context line */}
            <p className="text-[12px]" style={{ color: 'var(--os-text-2)' }}>
              Location:{' '}
              <span className="mono">
                {selectedLocation ? `${formatLatitude(selectedLocation.latitude)} · ${formatLongitude(selectedLocation.longitude)}` : '—'}
              </span>{' '}
              · {selectedVariable} · {selectedDepth} m · {selectedDate}
            </p>

            {/* OBSERVED EVIDENCE */}
            <EvidenceBlock
              label="Observed evidence"
              body={
                <div className="space-y-2">
                  <div className="mono text-[15px] font-semibold tracking-wide" style={{ color: 'var(--os-text)' }}>
                    {diagnostic.errorFingerprint || 'DIAGNOSTIC_COMPLETE'}
                  </div>
                  {diagnostic.evidence.length === 0 ? (
                    <p className="text-[12px]" style={{ color: 'var(--os-text-2)' }}>
                      No numerical evidence strings were returned for this diagnostic.
                    </p>
                  ) : (
                    <ul className="divide-y divide-[var(--os-border)]">
                      {diagnostic.evidence.map((item, i) => (
                        <li key={i} className="mono py-1 text-[12px] leading-relaxed" style={{ color: 'var(--os-text-2)' }}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              }
            />

            {/* HYPOTHESIS — candidate causes */}
            <EvidenceBlock
              label="Hypothesis — candidate explanations"
              body={
                <>
                  <p className="mb-2 text-[11px]" style={{ color: 'var(--os-text-3)' }}>
                    Candidate explanations supported by available evidence. They are investigation
                    pathways and do NOT establish physical causation.
                  </p>
                  <div className="space-y-2">
                    {diagnostic.allCauses?.length
                      ? diagnostic.allCauses.map((cause, i) => (
                          <CauseRow key={`${cause.name}-${i}`} name={cause.name} confidence={cause.confidence} evidence={cause.evidence} />
                        ))
                      : diagnostic.possibleCause && (
                          <CauseRow name={diagnostic.possibleCause} confidence={diagnostic.confidence} evidence={diagnostic.evidence} />
                        )}
                  </div>
                </>
              }
            />

            {/* RECOMMENDED INVESTIGATION */}
            <EvidenceBlock
              label="Recommended investigation"
              body={
                <>
                  {steps.length > 0 && (
                    <div className="mb-3">
                      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--os-text-3)' }}>
                        Investigation workflow
                      </div>
                      <div className="flex flex-wrap items-stretch gap-1">
                        {steps.map((step, i) => (
                          <div
                            key={step.id}
                            className="flex min-w-0 flex-1 basis-32 flex-col border px-2.5 py-1.5"
                            style={{
                              borderColor: step.status === 'complete' ? 'var(--os-border-light)' : 'var(--os-border)',
                              background: step.status === 'complete' ? 'var(--os-bg)' : 'var(--os-surface)',
                              opacity: step.status === 'inactive' ? 0.55 : 1,
                            }}
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <span
                                className="text-[10px] font-semibold uppercase tracking-wider"
                                style={{ color: step.status === 'active' ? 'var(--os-accent)' : 'var(--os-text-2)' }}
                              >
                                {i + 1}. {step.title}
                              </span>
                              <StatusBadge label={step.status} tone={step.status === 'complete' ? 'available' : step.status === 'active' ? 'warn' : 'neutral'} />
                            </div>
                            <span className="mt-0.5 text-[10px] leading-snug" style={{ color: 'var(--os-text-3)' }}>
                              {step.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {solution ? (
                    <div className="space-y-2">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--os-text-3)' }}>
                          Pathway
                        </div>
                        <p className="mt-0.5 text-[13px] leading-relaxed" style={{ color: 'var(--os-text)' }}>
                          {solution.recommendedTest}
                        </p>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'var(--os-text-3)' }}>
                          Expected outcome
                        </div>
                        <p className="mt-0.5 text-[12px] leading-relaxed" style={{ color: 'var(--os-text-2)' }}>
                          {solution.expectedOutcome}
                        </p>
                      </div>
                      {solution.caution && (
                        <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--os-text-3)' }}>
                          {solution.caution}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[12px]" style={{ color: 'var(--os-text-2)' }}>
                      No investigation pathway was returned for this diagnostic.
                    </p>
                  )}
                </>
              }
            />

            {/* API caution — honesty about the limits of the analysis */}
            <p className="text-[10px] leading-relaxed" style={{ color: 'var(--os-text-3)' }}>
              Diagnostics are computed from nearby collocated observations on the sampled dates.
              They establish the discrepancy but not physical causation; additional independent
              observations and targeted model experiments are required before any correction is proposed.
            </p>
          </div>
        )}
      </SectionCard>
    </PageContainer>
  );
}

function EvidenceBlock({ label, body }: { label: string; body: ReactNode }) {
  return (
    <section className="border border-[var(--os-border)] bg-[var(--os-bg)] px-3 py-2.5">
      <div className="section-label mb-1.5">{label}</div>
      {body}
    </section>
  );
}

function CauseRow({
  name,
  confidence,
  evidence,
}: {
  name: string;
  confidence: string;
  evidence: string[];
}) {
  return (
    <div className="border border-[var(--os-border)] bg-[var(--os-surface)] px-3 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium" style={{ color: 'var(--os-text)' }}>{name}</span>
        <span className="shrink-0 text-[10px] uppercase tracking-[0.06em]" style={{ color: 'var(--os-text-3)' }}>
          {confidence} confidence
        </span>
      </div>
      {evidence.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {evidence.map((ev, j) => (
            <li key={j} className="mono text-[11px]" style={{ color: 'var(--os-text-2)' }}>{ev}</li>
          ))}
        </ul>
      )}
    </div>
  );
}