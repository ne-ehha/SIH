import { useOceanStore } from '@/state/oceanStore';
import { formatLatitude, formatLongitude } from '@/utils/coordinates';
import { regions } from '@/config/regions';
import { variables } from '@/config/variables';
import type { WorkspaceMode } from '@/types/ocean';

const WORKSPACE_PURPOSE: Record<WorkspaceMode, { name: string; purpose: string }> = {
  overview: { name: 'OCEANSCOPE', purpose: '' },
  globe: { name: 'GLOBE', purpose: 'DISCOVER' },
  research: { name: 'RESEARCH', purpose: 'INSPECT' },
  analysis: { name: 'ANALYSIS', purpose: 'COMPARE' },
  solutions: { name: 'SOLUTIONS', purpose: 'RESPOND' },
  report: { name: 'REPORT', purpose: 'COMMUNICATE' },
};

function formatResearchDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}

export function InvestigationContextStrip() {
  const {
    workspaceMode,
    selectedObservationId,
    selectedLocation,
    selectedDate,
    selectedVariable,
    selectedRegion,
  } = useOceanStore();

  const purpose = WORKSPACE_PURPOSE[workspaceMode];
  const regionName = regions.find((r) => r.id === selectedRegion)?.name ?? 'Bay of Bengal';
  const variableName =
    variables.find((v) => v.id === selectedVariable)?.label ?? selectedVariable;

  const hasObservation =
    selectedObservationId !== null && selectedLocation !== null;

  let platformLabel = '';
  if (hasObservation && selectedObservationId) {
    const parts = selectedObservationId.split('_');
    const platformNum = parts[1] || '';
    const cycleNum = parts[2] || '';
    platformLabel = `ARGO ${platformNum} / C${cycleNum}`;
  }

  return (
    <div className="investigation-strip">
      <div className="inv-group">
        {/* key={workspaceMode} forces remount on workspace change,
            triggering the inv-purpose-enter CSS animation */}
        <span className="inv-purpose inv-purpose-enter" key={workspaceMode}>
          {purpose.name}
          <span className="inv-purpose-sep">·</span>
          {purpose.purpose}
        </span>
      </div>

      {hasObservation && selectedLocation ? (
        <>
          <span className="inv-sep" />
          <div className="inv-group min-w-0">
            <span className="inv-highlight truncate">
              {platformLabel}
              <span className="inv-meta-inline">
                {' '}
                · {formatLatitude(selectedLocation.latitude)} ·{' '}
                {formatLongitude(selectedLocation.longitude)}
              </span>
            </span>
          </div>
        </>
      ) : (
        <>
          <span className="inv-sep" />
          <div className="inv-group">
            <span className="inv-value" style={{ color: 'var(--os-text-3)' }}>
              No observation selected
            </span>
          </div>
        </>
      )}

      <span className="inv-sep" />
      <div className="inv-group min-w-0 flex-1">
        <span className="inv-context truncate">
          GLORYS12V1 × ARGO DELAYED MODE
          <span className="inv-meta-inline">
            {' '}
            · {regionName} · {formatResearchDate(selectedDate)} · {variableName}
          </span>
        </span>
      </div>
    </div>
  );
}
