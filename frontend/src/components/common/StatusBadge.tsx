import type { CSSProperties } from 'react';

export type StatusTone = 'available' | 'warn' | 'error' | 'neutral';

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
}

const toneStyles: Record<StatusTone, CSSProperties> = {
  available: { color: 'var(--os-success)', borderColor: 'rgba(34, 197, 94, 0.40)' },
  warn: { color: 'var(--os-warn)', borderColor: 'rgba(245, 158, 11, 0.40)' },
  error: { color: 'var(--os-error)', borderColor: 'rgba(239, 68, 68, 0.40)' },
  neutral: { color: 'var(--os-text-3)', borderColor: 'var(--os-border-light)' },
};

/** Compact uppercase status badge (Available / In preparation / …). */
export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <span className="status-badge" style={toneStyles[tone]}>
      {label}
    </span>
  );
}