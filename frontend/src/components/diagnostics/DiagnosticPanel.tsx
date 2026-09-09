import { useState, useEffect } from 'react';
import { useOceanStore } from '@/state/oceanStore';
import { runDiagnostics } from '@/services/diagnosticsService';
import type { DiagnosticResult } from '@/types/diagnostics';

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
    return (
      <div className="panel">
        <div className="panel-header">Diagnostic Analysis</div>
        <div className="p-3 text-center text-[10px] py-6" style={{ color: 'var(--os-text-3)' }}>Select a location to run diagnostics</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="panel">
        <div className="panel-header">Diagnostic Analysis</div>
        <div className="flex items-center justify-center py-6">
          <div className="flex flex-col items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-[1.5px] border-t-transparent" style={{ borderColor: 'var(--os-argo)', borderTopColor: 'transparent' }} />
            <p className="text-[10px]" style={{ color: 'var(--os-text-3)' }}>Running diagnostic analysis...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel">
        <div className="panel-header">Diagnostic Analysis</div>
        <div className="p-3 text-center">
          <p className="text-[10px]" style={{ color: '#ef4444' }}>{error}</p>
          <button onClick={loadData} className="mt-2 text-[10px]" style={{ color: 'var(--os-accent)' }}>Retry</button>
        </div>
      </div>
    );
  }

  if (!diagnostic) {
    return (
      <div className="panel">
        <div className="panel-header">Diagnostic Analysis</div>
        <div className="p-3 text-center text-[10px] py-6" style={{ color: 'var(--os-text-3)' }}>No diagnostic result available</div>
      </div>
    );
  }

  const confidenceColor: Record<string, string> = {
    low: 'var(--os-diff-pos)',
    medium: 'var(--os-diff-pos)',
    high: 'var(--os-success)',
  };

  return (
    <div className="panel">
      <div className="panel-header">Diagnostic Analysis</div>
      <div className="p-3 space-y-3">
        {diagnostic.errorFingerprint && (
          <div>
            <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: 'var(--os-text-muted)' }}>Error Fingerprint</p>
            <p className="mono text-[11px]" style={{ color: 'var(--os-diff-pos)' }}>{diagnostic.errorFingerprint}</p>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--os-text-muted)' }}>Contributor</p>
            <span className="text-[9px] font-medium" style={{ color: confidenceColor[diagnostic.confidence] }}>
              {diagnostic.confidence.charAt(0).toUpperCase() + diagnostic.confidence.slice(1)} Confidence
            </span>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--os-accent)' }}>{diagnostic.possibleCause}</p>
        </div>

        <div>
          <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: 'var(--os-text-muted)' }}>Evidence</p>
          <ul className="space-y-1">
            {diagnostic.evidence.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[10px]" style={{ color: 'var(--os-text-2)' }}>
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full" style={{ background: 'var(--os-argo)' }} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[9px] italic border-t pt-2" style={{ color: 'var(--os-text-muted)', borderColor: 'var(--os-border)' }}>
          Indicative only. Backend analysis engine provides final conclusions.
        </p>
      </div>
    </div>
  );
}
