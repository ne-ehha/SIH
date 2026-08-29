import { useOceanStore } from '@/state/oceanStore';
import { variables } from '@/config/variables';
import type { OceanVariable } from '@/types/ocean';

export function VariableControls() {
  const { selectedVariable, setSelectedVariable } = useOceanStore();

  return (
    <div>
      <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        Variable
      </h4>
      <div className="space-y-1">
        {variables.map((v) => (
          <button
            key={v.id}
            onClick={() => setSelectedVariable(v.id as OceanVariable)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs transition ${
              selectedVariable === v.id
                ? 'bg-purple-900/30 text-purple-300 ring-1 ring-purple-700/50'
                : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
            }`}
          >
            <span
              className="h-3 w-3 rounded-sm"
              style={{
                background: `linear-gradient(135deg, ${v.colorScale[0]}, ${v.colorScale[v.colorScale.length - 1]})`,
              }}
            />
            {v.label}
            <span className="ml-auto text-[10px] text-slate-600">{v.unit}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
