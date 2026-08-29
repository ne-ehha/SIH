import { useState, useEffect } from 'react';
import { useOceanStore } from '@/state/oceanStore';
import { runDiagnostics } from '@/services/diagnosticsService';
import type { DiagnosticResult } from '@/types/diagnostics';
import { LoadingState } from '@/components/common/LoadingState';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';

export function DiagnosticPanel() {
  const { selectedLocation, selectedVariable, selectedDepth } = useOceanStore();
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!selectedLocation) return;
    setLoading(true);
    setError(null);
    try {
      const result = await runDiagnostics(selectedLocation, selectedVariable, selectedDepth);
      setDiagnostic(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Diagnostics unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLocation) {
      loadData();
    }
  }, [selectedLocation, selectedVariable, selectedDepth]);

  if (!selectedLocation) {
    return <EmptyState message="Select a location to run diagnostics" icon="🔍" />;
  }

  if (loading) return <LoadingState message="Running diagnostic analysis..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;
  if (!diagnostic) return <EmptyState message="No diagnostic result available" />;

  const confidenceColor = {
    low: 'text-yellow-400 bg-yellow-900/30',
    medium: 'text-orange-400 bg-orange-900/30',
    high: 'text-green-400 bg-green-900/30',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Diagnostic Analysis</h3>
        <span className="text-[10px] text-slate-500">Mock data — Backend pending</span>
      </div>

      {/* Error Fingerprint */}
      {diagnostic.errorFingerprint && (
        <div className="rounded-lg border border-amber-800/50 bg-amber-900/20 p-3">
          <p className="text-[10px] uppercase tracking-wider text-amber-500">Error Fingerprint</p>
          <p className="mt-1 font-mono text-sm text-amber-300">{diagnostic.errorFingerprint}</p>
        </div>
      )}

      {/* Possible Cause */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-white">Possible Contributor</h4>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${confidenceColor[diagnostic.confidence]}`}>
            {diagnostic.confidence.charAt(0).toUpperCase() + diagnostic.confidence.slice(1)} Confidence
          </span>
        </div>
        <p className="mt-2 text-sm text-cyan-300">{diagnostic.possibleCause}</p>
      </div>

      {/* Evidence */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <h4 className="mb-2 text-sm font-medium text-white">Evidence</h4>
        <ul className="space-y-1.5">
          {diagnostic.evidence.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Scientific integrity note */}
      <div className="rounded-lg border border-slate-800/50 bg-slate-900/20 p-3">
        <p className="text-[10px] text-slate-500 italic">
          This analysis is indicative only. The frontend does not perform scientific inference. 
          All diagnostic conclusions will come from the backend analysis engine.
        </p>
      </div>
    </div>
  );
}
