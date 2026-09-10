import { useOceanStore } from '@/state/oceanStore';
import { variables } from '@/config/variables';
import type { OceanVariable } from '@/types/ocean';

export function VariableControls() {
  const { selectedVariable, setSelectedVariable } = useOceanStore();

  return (
    <div>
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--os-text-muted)' }}>
        Variable
      </h4>
      <div className="space-y-1">
        {variables.map((v) => (
          <button
            key={v.id}
            onClick={() => setSelectedVariable(v.id as OceanVariable)}
            className="flex w-full items-center gap-2 px-2 py-1 text-[12px] transition"
            style={{
              color: selectedVariable === v.id ? 'var(--os-accent)' : 'var(--os-text-3)',
              background: selectedVariable === v.id ? 'rgba(6,182,212,0.08)' : undefined,
              borderLeft: selectedVariable === v.id ? '2px solid var(--os-accent)' : '2px solid transparent',
            }}
          >
            <span
              className="h-3 w-3 rounded-sm"
              style={{
                background: `linear-gradient(135deg, ${v.colorScale[0]}, ${v.colorScale[v.colorScale.length - 1]})`,
              }}
            />
            {v.label}
            <span className="ml-auto text-[10px]" style={{ color: 'var(--os-text-muted)' }}>{v.unit}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
