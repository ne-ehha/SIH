import { useOceanStore } from '@/state/oceanStore';
import { formatLatitude, formatLongitude } from '@/utils/coordinates';

export function CoordinateMarker() {
  const { selectedLocation } = useOceanStore();

  if (!selectedLocation) return null;

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 px-3 py-1.5"
      style={{
        border: '1px solid var(--os-border)',
        background: 'var(--os-surface)',
        color: 'var(--os-text)',
      }}
    >
      <p className="text-[12px] font-medium mono">
        {formatLatitude(selectedLocation.latitude)} &nbsp; {formatLongitude(selectedLocation.longitude)}
      </p>
    </div>
  );
}
