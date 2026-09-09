import { useOceanStore } from '@/state/oceanStore';

export function DepthControl() {
  const { selectedDepth, setSelectedDepth } = useOceanStore();

  const presetDepths = [0, 50, 100, 200, 500, 1000, 2000];

  return (
    <div>
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--os-text-muted)' }}>
        Depth Control
      </h4>
      <input
        type="range"
        min="0"
        max="2000"
        step="25"
        value={selectedDepth}
        onChange={(e) => setSelectedDepth(Number(e.target.value))}
        className="w-full"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px]" style={{ color: 'var(--os-text-muted)' }}>0 m</span>
        <span className="text-[12px] font-medium" style={{ color: 'var(--os-accent)' }}>{selectedDepth} m</span>
        <span className="text-[10px]" style={{ color: 'var(--os-text-muted)' }}>2000 m</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {presetDepths.map((depth) => (
          <button
            key={depth}
            onClick={() => setSelectedDepth(depth)}
            className="rounded px-2 py-0.5 text-[10px] transition"
            style={{
              background: selectedDepth === depth ? 'var(--os-accent)' : 'var(--os-surface-2)',
              color: selectedDepth === depth ? 'var(--os-text)' : 'var(--os-text-2)',
            }}
          >
            {depth}m
          </button>
        ))}
      </div>
    </div>
  );
}
