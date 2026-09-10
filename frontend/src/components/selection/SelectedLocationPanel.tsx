import { useOceanStore } from '@/state/oceanStore';
import { formatLatitude, formatLongitude, formatDepth } from '@/utils/coordinates';
import { variables } from '@/config/variables';
import { regions } from '@/config/regions';

export function SelectedLocationPanel() {
  const {
    selectedLocation,
    selectedDepth,
    selectedVariable,
    selectedDate,
    selectedRegion,
    selectedObservationId,
    setWorkspaceMode,
  } = useOceanStore();

  const variableInfo = variables.find((v) => v.id === selectedVariable);
  const regionInfo = regions.find((r) => r.id === selectedRegion);
  const hasSelection = selectedLocation !== null;
  const hasObservation = selectedObservationId !== null;

  // Parse platform and cycle from observation ID (argo_{platform}_{cycle})
  let platformLabel = '';
  let cycleLabel = '';
  if (selectedObservationId) {
    const parts = selectedObservationId.split('_');
    if (parts.length >= 3) {
      platformLabel = parts[1];
      cycleLabel = parts[2];
    }
  }

  return (
    <div className="bg-[var(--os-surface)] border border-[var(--os-border)] w-full">
      {/* Header */}
      <div className="px-2.5 py-1.5 border-b border-[var(--os-border)]">
        <span className="text-[12px] font-semibold tracking-wide uppercase text-[var(--os-text-3)]">
          {hasObservation ? 'Profile Inspector' : 'Selected Location'}
        </span>
      </div>

      {/* Observation identity */}
      {hasObservation && (
        <div className="px-2.5 py-2 border-b border-[var(--os-border)]">
          <div className="mono text-[12px] text-[var(--os-argo)] font-medium">
            ARGO {platformLabel}
          </div>
          <div className="text-[10px] text-[var(--os-text-3)] mt-0.5">
            Cycle {cycleLabel} · real Argo profile
          </div>
        </div>
      )}

      {/* Metadata rows */}
      <div className="px-2.5 py-1.5">
        <MetaRow label="Latitude" value={hasSelection ? formatLatitude(selectedLocation.latitude) : '—'} active={hasSelection} />
        <MetaRow label="Longitude" value={hasSelection ? formatLongitude(selectedLocation.longitude) : '—'} active={hasSelection} />
        <div className="border-t border-[var(--os-border)] my-0.5" />
        <MetaRow label="Depth (requested)" value={formatDepth(selectedDepth)} />
        <MetaRow label="Variable" value={variableInfo ? `${variableInfo.label} (${variableInfo.unit})` : '—'} />
        <MetaRow label="Observation date" value={selectedDate || '—'} mono />
        <MetaRow label="Region" value={regionInfo?.name || '—'} />
      </div>

      {/* Difference convention */}
      <div className="px-2.5 py-1.5 border-t border-[var(--os-border)]">
        <MetaRow label="Convention" value="GLORYS − Argo" mono />
        <p className="text-[9px] text-[var(--os-text-muted)] mt-0.5">
          Positive = model higher than observation
        </p>
      </div>

      {/* Action — explicit Inspect Profile (never auto-navigates on marker click) */}
      <div className="px-2.5 py-2 border-t border-[var(--os-border)]">
        {hasObservation ? (
          <>
            <button
              onClick={() => setWorkspaceMode('research')}
              className="w-full rounded-sm px-3 py-1.5 text-[11px] font-semibold transition"
              style={{
                background: 'var(--os-accent)',
                color: '#fff',
                border: '1px solid var(--os-accent)',
              }}
            >
              Inspect Profile
            </button>
            <p className="mt-1 text-center text-[9px] text-[var(--os-text-muted)]">
              Open in Research workspace for 3D inspection
            </p>
          </>
        ) : (
          <p className="text-center text-[10px] py-1.5 text-[var(--os-text-muted)] leading-relaxed">
            Click a cyan observation marker to select a real Argo profile.
            <br />
            Arbitrary globe clicks are navigation only.
          </p>
        )}
      </div>
    </div>
  );
}

function MetaRow({
  label,
  value,
  active,
  mono,
}: {
  label: string;
  value: string;
  active?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between text-[11px] py-0.5">
      <span className="text-[var(--os-text-muted)]">{label}</span>
      <span className={`${mono ? 'mono' : ''} ${active ? 'text-[var(--os-argo)] font-medium' : 'text-[var(--os-text-2)]'}`}>
        {value}
      </span>
    </div>
  );
}
