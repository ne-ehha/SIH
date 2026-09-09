import { useOceanStore } from '@/state/oceanStore';
import { regions } from '@/config/regions';

export function RegionView() {
  const { selectedRegion } = useOceanStore();
  const region = regions.find((r) => r.id === selectedRegion);

  if (!region) return null;

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-10">
      <div className="border px-3 py-2" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
        <p className="text-[10px]" style={{ color: 'var(--os-text-3)' }}>Current Region</p>
        <p className="text-[13px] font-medium" style={{ color: 'var(--os-argo)' }}>{region.name}</p>
        <p className="text-[10px]" style={{ color: 'var(--os-text-muted)' }}>
          {region.bounds.south}°S – {region.bounds.north}°N,{' '}
          {region.bounds.west}°W – {region.bounds.east}°E
        </p>
      </div>
    </div>
  );
}
