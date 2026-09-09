import type { DiagnosticResult } from '@/types/diagnostics';

interface PossibleCausesProps {
  diagnostic: DiagnosticResult | null;
}

export function PossibleCauses({ diagnostic }: PossibleCausesProps) {
  if (!diagnostic) return null;

  const causes = [
    { name: 'Vertical Mixing Parameterization', confidence: 'medium' as const },
    { name: 'Surface Forcing Error', confidence: 'low' as const },
    { name: 'Bathymetry Resolution', confidence: 'low' as const },
  ];

  const confidenceColor: Record<string, string> = {
    low: 'var(--os-diff-pos)',
    medium: 'var(--os-diff-pos)',
    high: 'var(--os-success)',
  };

  return (
    <div className="space-y-3">
      <h4 className="text-[12px] font-semibold" style={{ color: 'var(--os-text)' }}>Possible Contributing Factors</h4>
      {causes.map((cause, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded border p-2"
          style={{
            borderColor: cause.name === diagnostic.possibleCause ? 'rgba(34,211,238,0.3)' : 'var(--os-border)',
            background: cause.name === diagnostic.possibleCause ? 'rgba(34,211,238,0.1)' : 'var(--os-surface)',
          }}
        >
          <span className="text-[12px]" style={{ color: 'var(--os-text)' }}>{cause.name}</span>
          <span className="text-[10px]" style={{ color: confidenceColor[cause.confidence] }}>
            {cause.confidence}
          </span>
        </div>
      ))}
    </div>
  );
}
