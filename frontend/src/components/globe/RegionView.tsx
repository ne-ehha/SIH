import { useOceanStore } from '@/state/oceanStore';
import { regions } from '@/config/regions';

export function RegionView() {
  const { selectedRegion } = useOceanStore();
  const region = regions.find((r) => r.id === selectedRegion);

  if (!region) return null;

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-10">
      <div className="rounded-lg border border-slate-700/50 bg-[#0d1224]/80 px-3 py-2 backdrop-blur-md">
        <p className="text-[10px] text-slate-500">Current Region</p>
        <p className="text-sm font-medium text-cyan-300">{region.name}</p>
        <p className="text-[10px] text-slate-600">
          {region.bounds.south}°S – {region.bounds.north}°N,{' '}
          {region.bounds.west}°W – {region.bounds.east}°E
        </p>
      </div>
    </div>
  );
}
