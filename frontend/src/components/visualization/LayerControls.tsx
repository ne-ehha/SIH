import { useOceanStore } from '@/state/oceanStore';

export function LayerControls() {
  const { activeLayers, toggleLayer } = useOceanStore();

  return (
    <div>
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        Layers
      </h4>
      <div className="space-y-1">
        {activeLayers.map((layer) => (
          <button
            key={layer.id}
            onClick={() => toggleLayer(layer.id)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs transition ${
              layer.enabled
                ? 'bg-cyan-900/20 text-cyan-300'
                : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
            }`}
          >
            <span
              className={`h-3 w-3 rounded-sm border ${
                layer.enabled ? 'border-cyan-500 bg-cyan-500/30' : 'border-slate-600 bg-transparent'
              }`}
            />
            {layer.label}
          </button>
        ))}
      </div>
    </div>
  );
}
