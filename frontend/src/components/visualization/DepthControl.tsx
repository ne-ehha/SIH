import { useOceanStore } from '@/state/oceanStore';

export function DepthControl() {
  const { selectedDepth, setSelectedDepth } = useOceanStore();

  const presetDepths = [0, 50, 100, 200, 500, 1000, 2000];

  return (
    <div>
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        Depth Control
      </h4>
      <input
        type="range"
        min="0"
        max="2000"
        step="25"
        value={selectedDepth}
        onChange={(e) => setSelectedDepth(Number(e.target.value))}
        className="w-full accent-cyan-500"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-slate-600">0 m</span>
        <span className="text-xs font-medium text-cyan-400">{selectedDepth} m</span>
        <span className="text-[10px] text-slate-600">2000 m</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {presetDepths.map((depth) => (
          <button
            key={depth}
            onClick={() => setSelectedDepth(depth)}
            className={`rounded px-2 py-0.5 text-[10px] transition ${
              selectedDepth === depth
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {depth}m
          </button>
        ))}
      </div>
    </div>
  );
}
