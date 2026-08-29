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

  const confidenceColor = {
    low: 'text-yellow-400',
    medium: 'text-orange-400',
    high: 'text-green-400',
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-white">Possible Contributing Factors</h4>
      {causes.map((cause, i) => (
        <div
          key={i}
          className={`flex items-center justify-between rounded-lg border p-2 ${
            cause.name === diagnostic.possibleCause
              ? 'border-cyan-800/50 bg-cyan-900/20'
              : 'border-slate-800 bg-slate-900/20'
          }`}
        >
          <span className="text-xs text-slate-300">{cause.name}</span>
          <span className={`text-[10px] ${confidenceColor[cause.confidence]}`}>
            {cause.confidence}
          </span>
        </div>
      ))}
    </div>
  );
}
