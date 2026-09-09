import { useState, useEffect, type ReactNode } from 'react';
import { useOceanStore } from '@/state/oceanStore';
import { runDiagnostics, getRecommendations } from '@/services/diagnosticsService';
import type {
  DiagnosticResult,
  DiagnosticCauseItem,
  SolutionRecommendation,
} from '@/types/diagnostics';
import { formatLatitude, formatLongitude } from '@/utils/coordinates';

// Module-level cache for diagnostic results keyed by investigation state.
// Avoids re-fetching when the user navigates away and back to Solutions
// with the same location/variable/depth/date.
const diagnosticCache = new Map<string, { diagnostic: DiagnosticResult; solution: SolutionRecommendation | null }>();

function cacheKey(loc: { latitude: number; longitude: number } | null, variable: string, depth: number, date: string): string {
  if (!loc) return '';
  return `${loc.latitude.toFixed(4)}|${loc.longitude.toFixed(4)}|${variable}|${depth}|${date}`;
}

/**
 * Solutions — RESPOND workspace.
 * Presents diagnostics API output as investigation evidence.
 * Does not invent scientific conclusions or claim float-specific causality.
 */
export function SolutionsPanel() {
  const { selectedLocation, selectedVariable, selectedDepth, selectedDate } = useOceanStore();
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [solution, setSolution] = useState<SolutionRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!selectedLocation) return;

    // Check cache first
    const key = cacheKey(selectedLocation, selectedVariable, selectedDepth, selectedDate);
    const cached = diagnosticCache.get(key);
    if (cached) {
      setDiagnostic(cached.diagnostic);
      setSolution(cached.solution);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const diag = await runDiagnostics(selectedLocation, selectedVariable, selectedDepth);
      setDiagnostic(diag);
      const result = await getRecommendations();
      setSolution(result);
      // Cache the result
      diagnosticCache.set(key, { diagnostic: diag, solution: result });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Diagnostic evidence could not be retrieved.');
      setDiagnostic(null);
      setSolution(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLocation) {
      loadData();
    } else {
      setDiagnostic(null);
      setSolution(null);
    }
  }, [selectedLocation, selectedVariable, selectedDepth, selectedDate]);

  if (!selectedLocation) {
    return (
      <WorkspaceShell>
        <EmptyBlock message="No diagnostic evidence is available until a location is selected." />
      </WorkspaceShell>
    );
  }

  if (loading) {
    return (
      <WorkspaceShell>
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-[1.5px] border-[var(--os-accent)] border-t-transparent" />
          <p className="text-[13px] text-[var(--os-text-2)]">
            Retrieving diagnostic evidence for this location…
          </p>
        </div>
      </WorkspaceShell>
    );
  }

  if (error) {
    return (
      <WorkspaceShell>
        <div className="px-4 py-8 text-center">
          <p className="text-[13px] text-[var(--os-diff-pos)]">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="mt-3 text-[12px] text-[var(--os-accent)] hover:text-[var(--os-text)]"
          >
            Retry
          </button>
        </div>
      </WorkspaceShell>
    );
  }

  if (!diagnostic) {
    return (
      <WorkspaceShell>
        <EmptyBlock message="No diagnostic evidence is available for this location." />
      </WorkspaceShell>
    );
  }

  const causes: DiagnosticCauseItem[] =
    diagnostic.allCauses && diagnostic.allCauses.length > 0
      ? diagnostic.allCauses
      : [
          {
            name: diagnostic.possibleCause,
            confidence: diagnostic.confidence,
            evidence: diagnostic.evidence,
          },
        ];

  const fingerprint = diagnostic.errorFingerprint || 'DIAGNOSTIC_COMPLETE';

  return (
    <div className="border border-[var(--os-border)] bg-[var(--os-surface)]">
      <header className="border-b border-[var(--os-border)] px-4 py-3">
        <div className="text-[13px] font-semibold text-[var(--os-text)]">
          Discrepancy response
        </div>
        <div className="mt-1 text-[12px] text-[var(--os-text-2)]">
          Diagnostic evidence for this location · nearby collocations ·{' '}
          {formatLatitude(selectedLocation.latitude)} · {formatLongitude(selectedLocation.longitude)} ·{' '}
          {selectedDepth} m
        </div>
        <p className="mt-2 text-[11px] text-[var(--os-text-3)] leading-relaxed max-w-3xl">
          Analysis uses nearby GLORYS12V1 × Argo collocations around the selected coordinates.
          It does not establish that a single Argo float caused the pattern, and candidate
          explanations are investigation pathways—not confirmed physical causes.
        </p>
      </header>

      <div className="p-4 space-y-5">
        {/* Fingerprint */}
        <section>
          <SectionLabel>Discrepancy fingerprint</SectionLabel>
          <div className="mt-2 border border-[var(--os-border)] bg-[var(--os-bg)] px-4 py-3">
            <div className="mono text-[18px] font-semibold text-[var(--os-text)] tracking-wide">
              {fingerprint}
            </div>
            <div className="mt-2 text-[13px] text-[var(--os-text-2)]">
              Leading candidate: {diagnostic.possibleCause}
              <span className="text-[var(--os-text-3)]"> · </span>
              <span className="capitalize">{diagnostic.confidence} confidence</span>
            </div>
          </div>
        </section>

        {/* Evidence from top / primary cause */}
        <section>
          <SectionLabel>Evidence</SectionLabel>
          {diagnostic.evidence.length === 0 ? (
            <p className="mt-2 text-[13px] text-[var(--os-text-2)]">
              No numerical evidence strings were returned for this diagnostic.
            </p>
          ) : (
            <ul className="mt-2 border border-[var(--os-border)] bg-[var(--os-bg)] divide-y divide-[var(--os-border)]">
              {diagnostic.evidence.map((item, i) => (
                <li key={i} className="px-4 py-2.5 text-[14px] text-[var(--os-text)] mono leading-relaxed">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Candidate explanations */}
        <section>
          <SectionLabel>Candidate explanations</SectionLabel>
          <p className="mt-1 text-[12px] text-[var(--os-text-3)]">
            Returned by the diagnostics API. Treat as hypotheses supported by available
            evidence—not proven causes.
          </p>
          <div className="mt-2 space-y-2">
            {causes.map((cause, i) => (
              <div key={`${cause.name}-${i}`} className="border border-[var(--os-border)] bg-[var(--os-bg)] px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-[14px] font-medium text-[var(--os-text)]">{cause.name}</div>
                  <div className="text-[11px] uppercase tracking-[0.06em] text-[var(--os-text-3)] shrink-0 capitalize">
                    {cause.confidence} confidence
                  </div>
                </div>
                {cause.evidence.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {cause.evidence.map((ev, j) => (
                      <li key={j} className="text-[12px] text-[var(--os-text-2)] mono">
                        {ev}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Recommended investigation pathway */}
        <section>
          <SectionLabel>Recommended investigation</SectionLabel>
          <p className="mt-1 text-[12px] text-[var(--os-text-3)]">
            Investigation pathway from the diagnostics workflow—not an automatic scientific conclusion.
          </p>
          {solution ? (
            <div className="mt-2 border border-[var(--os-border)] bg-[var(--os-bg)] px-4 py-3 space-y-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--os-text-3)]">
                  Pathway
                </div>
                <p className="mt-1 text-[14px] text-[var(--os-text)] leading-relaxed">
                  {solution.recommendedTest}
                </p>
              </div>
              <div className="border-t border-[var(--os-border)] pt-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--os-text-3)]">
                  Expected outcome
                </div>
                <p className="mt-1 text-[13px] text-[var(--os-text-2)] leading-relaxed">
                  {solution.expectedOutcome}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-[var(--os-text-2)]">
              No investigation pathway was returned for this diagnostic.
            </p>
          )}
        </section>

        {/* Scientific caution from API */}
        <section>
          <SectionLabel>Scientific caution</SectionLabel>
          <div className="mt-2 border border-[var(--os-border)] bg-[var(--os-bg)] px-4 py-3">
            <p className="text-[13px] text-[var(--os-text-2)] leading-relaxed italic">
              {solution?.caution ||
                'These are candidate explanations supported by available evidence. They do not establish physical causation.'}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="border border-[var(--os-border)] bg-[var(--os-surface)] min-h-[240px]">
      <header className="border-b border-[var(--os-border)] px-4 py-3">
        <div className="text-[13px] font-semibold text-[var(--os-text)]">Discrepancy response</div>
        <div className="mt-0.5 text-[12px] text-[var(--os-text-2)]">
          Diagnostic evidence for this location
        </div>
      </header>
      {children}
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="text-[13px] text-[var(--os-text-2)] leading-relaxed max-w-md mx-auto">{message}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--os-text-2)]">
      {children}
    </div>
  );
}
