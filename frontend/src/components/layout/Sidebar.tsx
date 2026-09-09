import { useMemo } from 'react';
import { useOceanStore } from '@/state/oceanStore';
import { variables } from '@/config/variables';
import type { OceanVariable } from '@/types/ocean';

const RESEARCH_VARIABLES = new Set(['temperature', 'salinity']);
const PIPELINE_A_DATES = new Set([
  '2024-01-01', '2024-01-04', '2024-01-06', '2024-01-07',
  '2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-14',
]);

export function Sidebar() {
  const {
    selectedVariable,
    setSelectedVariable,
    selectedDepth,
    setSelectedDepth,
    selectedDate,
    setSelectedDate,
    selectedObservationId,
    sidebarCollapsed,
    toggleSidebar,
    triggerFitAllObservations,
  } = useOceanStore();

  const isResearchDate = PIPELINE_A_DATES.has(selectedDate);
  const visibleVariables = useMemo(
    () => isResearchDate ? variables.filter(v => RESEARCH_VARIABLES.has(v.id)) : variables,
    [isResearchDate]
  );

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    const nowResearch = PIPELINE_A_DATES.has(newDate);
    if (nowResearch && !RESEARCH_VARIABLES.has(selectedVariable)) {
      setSelectedVariable('temperature');
    }
  };

  if (sidebarCollapsed) {
    return (
      <aside className="flex h-full w-10 flex-col items-center border-r border-[var(--os-border)] bg-[var(--os-surface)] py-2">
        <button
          onClick={toggleSidebar}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--os-text-3)] transition hover:bg-[var(--os-surface-2)] hover:text-[var(--os-text-2)] mb-2"
          title="Expand control rail"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
        <div className="flex flex-col items-center gap-1.5 mt-2">
          <span className="text-[10px] text-[var(--os-text-muted)]">V</span>
          <span className="text-[10px] text-[var(--os-text-muted)]">D</span>
          <span className="text-[10px] text-[var(--os-text-muted)]">Z</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[180px] flex-col border-r border-[var(--os-border)] bg-[var(--os-surface)] overflow-y-auto select-none">
      {/* Collapse button */}
      <div className="flex items-center justify-end px-2 py-1.5">
        <button
          onClick={toggleSidebar}
          className="flex h-4 w-4 items-center justify-center rounded text-[var(--os-text-muted)] transition hover:bg-[var(--os-surface-2)] hover:text-[var(--os-text-3)]"
          title="Collapse"
        >
          <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      {/* ── VARIABLE ── */}
      <div className="section-label">Variable</div>
      <div className="px-2 pb-0.5">
        {visibleVariables.map((v) => (
          <button
            key={v.id}
            onClick={() => setSelectedVariable(v.id as OceanVariable)}
            className={`flex w-full items-center gap-2 px-2 py-1.5 text-[13px] transition ${
              selectedVariable === v.id
                ? 'text-[var(--os-accent)] border-l-2 border-[var(--os-accent)] bg-[rgba(59,130,200,0.08)]'
                : 'text-[var(--os-text-2)] hover:text-[var(--os-text)] border-l-2 border-transparent'
            }`}
          >
            <span className={`h-2 w-2 rounded-sm shrink-0 ${
              selectedVariable === v.id ? 'bg-[var(--os-accent)]' : 'bg-[var(--os-text-muted)]'
            }`} />
            <span className="flex-1 text-left font-medium">{v.label}</span>
            <span className="text-[11px] text-[var(--os-text-muted)] mono">{v.unit}</span>
          </button>
        ))}
      </div>
      <div className="section-sep" />

      {/* ── DATE ── */}
      <div className="section-label">Date</div>
      <div className="px-2 pb-0.5">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => handleDateChange(e.target.value)}
          min="2024-01-01"
          max="2024-01-15"
          className="w-full rounded-sm border border-[var(--os-border)] bg-[var(--os-bg)] px-2 py-1.5 text-[12px] text-[var(--os-text)] outline-none focus:border-[var(--os-accent)] mono"
        />
        <p className="mt-1 text-[11px] text-[var(--os-text-muted)]">Observations: Jan 1–14, 2024</p>
      </div>
      <div className="section-sep" />

      {/* ── DEPTH ── */}
      <div className="section-label">Depth</div>
      <div className="px-2 pb-1.5">
        {/* Numeric input with unit */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="flex items-center flex-1 rounded border" style={{ borderColor: 'var(--os-border)', background: 'var(--os-bg)' }}>
            <input
              type="number"
              min="0"
              max="500"
              step="1"
              value={selectedDepth}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) setSelectedDepth(Math.max(0, Math.min(500, v)));
              }}
              onBlur={(e) => {
                const v = parseInt(e.target.value, 10);
                if (isNaN(v)) setSelectedDepth(0);
              }}
              className="mono text-[13px] font-medium w-full text-center bg-transparent outline-none"
              style={{ color: 'var(--os-text)' }}
            />
          </div>
          <span className="text-[12px] font-medium" style={{ color: 'var(--os-text-3)' }}>m</span>
        </div>
        {/* Range slider */}
        <input
          type="range"
          min="0"
          max="500"
          step="1"
          value={selectedDepth}
          onChange={(e) => setSelectedDepth(Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-[9px] mt-0.5" style={{ color: 'var(--os-text-muted)' }}>
          <span>0</span>
          <span>500</span>
        </div>
      </div>
      <div className="section-sep" />

      {/* ── ACTIONS ── */}
      <div className="px-2 py-1">
        <button
          onClick={() => triggerFitAllObservations()}
          className="w-full rounded-sm border border-[var(--os-border)] bg-[var(--os-bg)] px-2 py-1.5 text-[11px] text-[var(--os-text-2)] transition hover:border-[var(--os-border-light)] hover:text-[var(--os-text)]"
        >
          Fit Observations
        </button>
      </div>
      <div className="section-sep" />

      {/* ── DATA PROVENANCE ── */}
      <div className="section-label">Data Provenance</div>
      <div className="px-2 pb-2">
        <ProvenanceRow label="Model" value="GLORYS12V1" />
        <ProvenanceRow label="Observation" value="Argo DM" />
        <ProvenanceRow label="Region" value="Bay of Bengal" />
        <ProvenanceRow label="Spatial" value="0.25° grid" />
        <ProvenanceRow label="Temporal" value="Daily nearest" />
        <ProvenanceRow label="Difference" value="GLORYS − Argo" />
        <ProvenanceRow label="Depth" value="0–500 m" />
      </div>

      {/* ── ACTIVE ── */}
      {selectedObservationId && (
        <>
          <div className="section-sep" />
          <div className="section-label">Active</div>
          <div className="px-2 pb-2">
            <div className="mono text-[11px] text-[var(--os-argo)] font-medium">
              {selectedObservationId.replace('argo_', '').replace('_', ' / ')}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

function ProvenanceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[11px] py-0.5">
      <span className="text-[var(--os-text-muted)]">{label}</span>
      <span className="text-[var(--os-text-2)] mono">{value}</span>
    </div>
  );
}
