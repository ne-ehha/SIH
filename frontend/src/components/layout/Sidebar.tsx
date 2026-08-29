import { useOceanStore } from '@/state/oceanStore';
import { regions } from '@/config/regions';
import { variables } from '@/config/variables';
import type { OceanVariable } from '@/types/ocean';

export function Sidebar() {
  const {
    selectedRegion,
    setSelectedRegion,
    selectedVariable,
    setSelectedVariable,
    selectedDepth,
    setSelectedDepth,
    selectedDate,
    setSelectedDate,
    selectedTime,
    setSelectedTime,
    activeLayers,
    toggleLayer,
    sidebarCollapsed,
    resetSelection,
  } = useOceanStore();

  if (sidebarCollapsed) {
    return (
      <aside className="flex h-full w-12 flex-col items-center border-r border-slate-800 bg-[#0b1020] py-4">
        <button
          onClick={resetSelection}
          className="mb-4 rounded p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          title="Expand sidebar"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
      </aside>
    );
  }

  const mainRegions = regions.filter((r) => ['bay-of-bengal', 'arabian-sea'].includes(r.id));
  const otherRegions = regions.filter((r) => !['bay-of-bengal', 'arabian-sea'].includes(r.id));

  return (
    <aside className="flex h-full w-64 flex-col border-r border-slate-800 bg-[#0b1020] overflow-y-auto">
      {/* Section: Global View */}
      <Section title="GLOBAL VIEW">
        <div className="space-y-1">
          <SidebarItem
            icon={<GlobeIcon />}
            label="Earth"
            active={false}
            onClick={() => {}}
          />
          <SidebarItem
            icon={<OceanIcon />}
            label="3D Ocean"
            active={false}
            onClick={() => {}}
          />
        </div>
      </Section>

      {/* Section: Water Bodies */}
      <Section title="WATER BODIES">
        <div className="space-y-1">
          {mainRegions.map((region) => (
            <SidebarItem
              key={region.id}
              icon={<WaterIcon />}
              label={region.name}
              active={selectedRegion === region.id}
              onClick={() => setSelectedRegion(region.id)}
            />
          ))}
          {otherRegions.length > 0 && (
            <details className="group">
              <summary className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-xs text-slate-500 transition hover:text-slate-300">
                <span className="text-[10px] transition group-open:rotate-90">▶</span>
                More oceans ({otherRegions.length})
              </summary>
              <div className="ml-4 space-y-1 border-l border-slate-800 pl-2">
                {otherRegions.map((region) => (
                  <SidebarItem
                    key={region.id}
                    icon={<WaterIcon size="sm" />}
                    label={region.name}
                    active={selectedRegion === region.id}
                    onClick={() => setSelectedRegion(region.id)}
                    small
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      </Section>

      {/* Section: Data Layers */}
      <Section title="DISPLAY / DATA LAYERS">
        <div className="space-y-1">
          {activeLayers.map((layer) => (
            <button
              key={layer.id}
              onClick={() => toggleLayer(layer.id)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
                layer.enabled
                  ? 'bg-cyan-900/20 text-cyan-300'
                  : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${layer.enabled ? 'bg-cyan-400' : 'bg-slate-600'}`} />
              {layer.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Section: Time */}
      <Section title="TIME">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900/50 px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-cyan-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">Time</label>
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900/50 px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-cyan-600"
            />
          </div>
          <div className="flex gap-2">
            <button className="flex-1 rounded-md border border-slate-700 bg-slate-800/50 py-1 text-[10px] text-slate-400 transition hover:bg-slate-700 hover:text-white">
              ◀ Prev
            </button>
            <button className="flex-1 rounded-md border border-slate-700 bg-slate-800/50 py-1 text-[10px] text-slate-400 transition hover:bg-slate-700 hover:text-white">
              ▶ Next
            </button>
          </div>
        </div>
      </Section>

      {/* Section: Depth */}
      <Section title="DEPTH">
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max="2000"
            step="25"
            value={selectedDepth}
            onChange={(e) => setSelectedDepth(Number(e.target.value))}
            className="w-full accent-cyan-500"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">0 m</span>
            <span className="text-xs font-medium text-cyan-400">{selectedDepth} m</span>
            <span className="text-[10px] text-slate-500">2000 m</span>
          </div>
        </div>
      </Section>

      {/* Section: Variable */}
      <Section title="VARIABLE">
        <div className="space-y-1">
          {variables.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVariable(v.id as OceanVariable)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
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
            </button>
          ))}
        </div>
      </Section>

      {/* Reset */}
      <div className="mt-auto border-t border-slate-800 p-3">
        <button
          onClick={resetSelection}
          className="w-full rounded-md border border-slate-700 bg-slate-800/50 py-1.5 text-xs text-slate-400 transition hover:border-red-800 hover:bg-red-900/20 hover:text-red-400"
        >
          Reset View
        </button>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-800/50 p-3">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">{title}</h3>
      {children}
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active,
  onClick,
  small,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-3 transition ${
        small ? 'py-1 text-[11px]' : 'py-1.5 text-sm'
      } ${
        active
          ? 'bg-cyan-900/30 text-cyan-300 ring-1 ring-cyan-700/40'
          : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
      }`}
    >
      <span className="shrink-0 opacity-60">{icon}</span>
      {label}
    </button>
  );
}

function GlobeIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function OceanIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
      <path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
    </svg>
  );
}

function WaterIcon({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <svg className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 15c6-6 14-6 20 0" />
    </svg>
  );
}
