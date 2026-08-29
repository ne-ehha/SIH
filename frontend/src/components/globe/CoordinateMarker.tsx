import { useOceanStore } from '@/state/oceanStore';
import { formatLatitude, formatLongitude } from '@/utils/coordinates';

export function CoordinateMarker() {
  const { selectedLocation } = useOceanStore();

  if (!selectedLocation) return null;

  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-lg border border-purple-700/50 bg-[#0d1224]/90 px-4 py-2 shadow-lg shadow-purple-900/20 backdrop-blur-md">
      <p className="text-sm font-medium text-purple-300">
        {formatLatitude(selectedLocation.latitude)} &nbsp; {formatLongitude(selectedLocation.longitude)}
      </p>
    </div>
  );
}
