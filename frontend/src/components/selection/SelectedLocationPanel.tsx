import { useOceanStore } from '@/state/oceanStore';
import { formatLatitude, formatLongitude, formatDepth } from '@/utils/coordinates';
import { variables } from '@/config/variables';
import { regions } from '@/config/regions';
import { Button } from '@/components/common/Button';

// HYCOM operational date range — 3D visualization is only available for these dates
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
    isModelViewOpen,
    setIsModelViewOpen,
  } = useOceanStore();

  const variableInfo = variables.find((v) => v.id === selectedVariable);
  const regionInfo = regions.find((r) => r.id === selectedRegion);

  const hasSelection = selectedLocation !== null;
  const isHycom = isHycomDate(selectedDate);

  return (
    <div className="rounded-xl border border-slate-700/50 bg-[#0d1224]/90 p-4 shadow-xl backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Selected Location</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            hasSelection
              ? 'bg-green-900/30 text-green-400'
              : 'bg-slate-700/50 text-slate-500'
          }`}
        >
          {hasSelection ? 'Ready' : 'No selection'}
        </span>
      </div>

      <div className="space-y-2">
        <InfoRow
          label="Latitude"
          value={hasSelection ? formatLatitude(selectedLocation.latitude) : '—'}
          highlight={hasSelection}
        />
        <InfoRow
          label="Longitude"
          value={hasSelection ? formatLongitude(selectedLocation.longitude) : '—'}
          highlight={hasSelection}
        />
        <InfoRow label="Depth" value={formatDepth(selectedDepth)} />
        <InfoRow label="Variable" value={variableInfo?.label || '—'} />
        <InfoRow label="Date" value={selectedDate || '—'} />
        <InfoRow label="Time" value={selectedTime || '—'} />
        <InfoRow label="Region" value={regionInfo?.name || '—'} />
      </div>

      <div className="mt-4 border-t border-slate-800 pt-3">
        <Button
          onClick={() => setIsModelViewOpen(true)}
          disabled={!hasSelection}
          className="w-full"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {isHycom ? 'View 3D Model' : 'View Research 3D'}
        </Button>
        {isHycom ? (
          <p className="mt-1.5 text-center text-[9px] text-slate-600">
            HYCOM operational visualization (Aug 26 - Sep 1, 2026)
          </p>
        ) : (
          <p className="mt-1.5 text-center text-[9px] text-slate-600">
            GLORYS × Argo collocated observations
          </p>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span
        className={`text-xs font-medium ${
          highlight ? 'text-purple-300' : 'text-slate-300'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
