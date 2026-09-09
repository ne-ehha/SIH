import { useOceanStore } from '@/state/oceanStore';

export function LayerControls() {
  const { activeLayers, toggleLayer } = useOceanStore();

  return (
    <div>
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--os-text-muted)' }}>
        Layers
      </h4>
      <div className="space-y-1">
        {activeLayers.map((layer) => (
          <button
            key={layer.id}
            onClick={() => toggleLayer(layer.id)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-[12px] transition"
            style={{
              color: layer.enabled ? 'var(--os-accent)' : 'var(--os-text-3)',
              background: layer.enabled ? 'rgba(34,211,238,0.1)' : undefined,
            }}
          >
            <span
              className="h-3 w-3 rounded-sm border"
              style={{
                borderColor: layer.enabled ? 'var(--os-argo)' : 'var(--os-border)',
                background: layer.enabled ? 'rgba(34,211,238,0.2)' : 'transparent',
              }}
            />
            {layer.label}
          </button>
        ))}
      </div>
    </div>
  );
}
