import { useOceanStore } from '@/state/oceanStore';

export function StatusBar() {
  const { selectedDepth, selectedVariable } = useOceanStore();

  return (
    <div className="flex h-5 items-center border-t border-[var(--os-border)] bg-[var(--os-surface)] px-3 text-[9px] select-none" style={{ color: 'var(--os-text-muted)' }}>
      <span>GLORYS12V1 × Argo Delayed Mode</span>
      <span className="mx-2" style={{ color: 'var(--os-border)' }}>·</span>
      <span>Bay of Bengal</span>
      <span className="mx-2" style={{ color: 'var(--os-border)' }}>·</span>
      <span>0–500 m validated</span>
      <span className="mx-2" style={{ color: 'var(--os-border)' }}>·</span>
      <span className="mono">{selectedVariable}</span>
      <span className="ml-auto mono" style={{ color: 'var(--os-text-2)' }}>{selectedDepth} m</span>
    </div>
  );
}
