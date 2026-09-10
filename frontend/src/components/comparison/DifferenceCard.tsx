interface DifferenceCardProps {
  label: string;
  value: number;
  unit: string;
  color: 'argo' | 'glorys' | 'diff-pos' | 'diff-neg';
  showSign?: boolean;
}

const colorStyles: Record<string, { border: string; bg: string; text: string }> = {
  argo:     { border: 'var(--os-argo)',     bg: 'rgba(34,211,238,0.08)',  text: 'var(--os-argo)' },
  glorys:   { border: 'var(--os-glorys)',   bg: 'rgba(168,85,247,0.08)',  text: 'var(--os-glorys)' },
  'diff-pos': { border: 'var(--os-diff-pos)', bg: 'rgba(232,166,58,0.08)', text: 'var(--os-diff-pos)' },
  'diff-neg': { border: 'var(--os-diff-neg)', bg: 'rgba(91,141,239,0.08)', text: 'var(--os-diff-neg)' },
};

export function DifferenceCard({ label, value, unit, color, showSign }: DifferenceCardProps) {
  const sign = showSign && value > 0 ? '+' : '';
  const s = colorStyles[color];

  return (
    <div
      className="p-3"
      style={{ border: `1px solid ${s.border}33`, background: s.bg }}
    >
      <p className="text-[10px] uppercase tracking-wider" style={{ color: s.text, opacity: 0.6 }}>{label}</p>
      <p className="mt-1 text-[18px] font-bold" style={{ color: s.text }}>
        {sign}{value.toFixed(2)}
      </p>
      <p className="text-[10px]" style={{ color: s.text, opacity: 0.5 }}>{unit}</p>
    </div>
  );
}
