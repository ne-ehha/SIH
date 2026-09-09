import { useOceanStore } from '@/state/oceanStore';
import { formatLatitude, formatLongitude, formatDepth } from '@/utils/coordinates';
import { variables } from '@/config/variables';
import { regions } from '@/config/regions';

const HYCOM_DATE_START = '2026-08-26';
const HYCOM_DATE_END = '2026-09-01';

function isHycomDate(date: string): boolean {
  return date >= HYCOM_DATE_START && date <= HYCOM_DATE_END;
}

export function SelectedLocationPanel() {
  const {
    selectedLocation,
    selectedDepth,
    selectedVariable,
    selectedDate,
    selectedTime,
    selectedRegion,
    setIsModelViewOpen,
  } = useOceanStore();

  const variableInfo = variables.find((v) => v.id === selectedVariable);
  const regionInfo = regions.find((r) => r.id === selectedRegion);
  const hasSelection = selectedLocation !== null;
  const isHycom = isHycomDate(selectedDate);

  // Parse observation context if available
  const { selectedObservationId } = useOceanStore();

  return (
    <div className="bg-[var(--os-surface)] border border-[var(--os-border)] w-full">
      {/* Header */}
      <div className="px-2.5 py-1.5 border-b border-[var(--os-border)]">
        <span className="text-[12px] font-semibold tracking-wide uppercase text-[var(--os-text-3)]">
          {selectedObservationId ? 'Selected Observation' : 'Selected Location'}
        </span>
      </div>

      {/* Observation ID */}
      {selectedObservationId && (
        <div className="px-2.5 py-2 border-b border-[var(--os-border)]">
          <div className="mono text-[12px] text-[var(--os-argo)] font-medium">
            {selectedObservationId.replace('argo_', '').replace('_', ' / Cycle ')}
          </div>
        </div>
      )}

      {/* Metadata rows */}
      <div className="px-2.5 py-1.5">
        <MetaRow label="Latitude" value={hasSelection ? formatLatitude(selectedLocation.latitude) : '—'} active={hasSelection} />
        <MetaRow label="Longitude" value={hasSelection ? formatLongitude(selectedLocation.longitude) : '—'} active={hasSelection} />
        <div className="border-t border-[var(--os-border)] my-0.5" />
        <MetaRow label="Depth" value={formatDepth(selectedDepth)} />
        <MetaRow label="Variable" value={variableInfo?.label || '—'} />
        <MetaRow label="Date" value={selectedDate || '—'} mono />
        <MetaRow label="Time" value={selectedTime ? `${selectedTime} UTC` : '—'} mono />
        <MetaRow label="Region" value={regionInfo?.name || '—'} />
      </div>

      {/* Action */}
      <div className="px-2.5 py-2 border-t border-[var(--os-border)]">
        <button
          onClick={() => setIsModelViewOpen(true)}
          disabled={!hasSelection}
          className="w-full rounded-sm border border-[var(--os-border)] bg-[var(--os-bg)] px-3 py-1.5 text-[11px] text-[var(--os-text-2)] transition hover:border-[var(--os-border-light)] hover:text-[var(--os-text)] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isHycom ? 'View 3D Model' : 'View Research 3D'}
        </button>
        <p className="mt-1 text-center text-[9px] text-[var(--os-text-muted)]">
          {isHycom ? 'HYCOM operational (Aug 26 – Sep 1, 2026)' : 'GLORYS × Argo collocated'}
        </p>
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
