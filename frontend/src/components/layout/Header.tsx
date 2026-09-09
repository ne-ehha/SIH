import { useOceanStore } from '@/state/oceanStore';
import type { WorkspaceMode } from '@/types/ocean';

const workspaceNavItems: {
  label: string;
  purpose: string;
  mode: WorkspaceMode;
}[] = [
  { label: 'Globe', purpose: 'DISCOVER', mode: 'globe' },
  { label: 'Research', purpose: 'INSPECT', mode: 'research' },
  { label: 'Analysis', purpose: 'COMPARE', mode: 'analysis' },
  { label: 'Solutions', purpose: 'RESPOND', mode: 'solutions' },
  { label: 'Report', purpose: 'COMMUNICATE', mode: 'report' },
];

/** Mode index for determining progression (which tabs are "past") */
const modeIndex: Record<WorkspaceMode, number> = {
  globe: 0,
  research: 1,
  analysis: 2,
  solutions: 3,
  report: 4,
};

export function Header() {
  const { workspaceMode, setWorkspaceMode, selectedObservationId } = useOceanStore();
  const activeIdx = modeIndex[workspaceMode];

  return (
    <header className="flex h-11 items-center border-b border-[var(--os-border)] bg-[var(--os-surface)] px-3 select-none">
      <div className="flex items-center mr-4 shrink-0">
        <img src="/oceanscope-logo.svg" alt="OceanScope" className="h-7 shrink-0" style={{ width: 'auto' }} />
      </div>

      <nav className="flex items-stretch gap-0 h-full" aria-label="Investigation workspaces">
        {workspaceNavItems.map(({ label, purpose, mode }, idx) => {
          const active = workspaceMode === mode;
          const past = idx < activeIdx;
          return (
            <div key={mode} className="flex items-stretch">
              {idx > 0 && (
                <span
                  className="flex items-center text-[10px]"
                  style={{ color: past ? 'var(--os-accent)' : 'var(--os-border)', opacity: 0.5 }}
                  aria-hidden
                >
                  ›
                </span>
              )}
              <button
                type="button"
                onClick={() => setWorkspaceMode(mode)}
                className={`workspace-tab relative flex flex-col justify-center px-3 py-1 transition-colors ${
                  active ? 'workspace-tab-active text-[var(--os-text)]' : past
                    ? 'text-[var(--os-text-3)] hover:text-[var(--os-text-2)]'
                    : 'text-[var(--os-text-2)] hover:text-[var(--os-text)]'
                }`}
              >
                <span className="text-[12px] font-medium leading-tight">{label}</span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.08em] leading-tight mt-0.5 ${
                    active ? 'text-[var(--os-accent)]' : 'text-[var(--os-text-3)]'
                  }`}
                >
                  {purpose}
                </span>
              </button>
            </div>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-3 text-[12px] shrink-0">
        {selectedObservationId && (
          <span className="mono text-[var(--os-argo)]">
            {selectedObservationId.replace('argo_', '').replace('_', ' / ')}
          </span>
        )}
      </div>
    </header>
  );
}
