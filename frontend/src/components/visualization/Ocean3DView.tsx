import { useOceanStore } from '@/state/oceanStore';
import { useVisualization3D } from '@/integration';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { DepthControl } from './DepthControl';
import { VariableControls } from './VariableControls';
import { LayerControls } from './LayerControls';
import type { SurfaceGridCell, DepthSliceDisplay, ProfileChartPoint } from '@/integration';

export function Ocean3DView() {
  const {
    selectedLocation,
    selectedVariable,
    selectedDate,
    selectedTime,
    isModelViewOpen,
    setIsModelViewOpen,
  } = useOceanStore();

  const {
    surfaceGrid,
    depthSlices,
    profileChart,
    unit,
    loading,
    error,
  } = useVisualization3D({
    latitude: selectedLocation?.latitude ?? null,
    longitude: selectedLocation?.longitude ?? null,
    variable: selectedVariable,
    date: selectedDate,
    time: selectedTime,
  });

  if (!isModelViewOpen || !selectedLocation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(8,12,22,0.85)' }}>
      <div className="mx-4 flex h-[90vh] w-full max-w-6xl flex-col border" style={{ borderColor: 'var(--os-border)', background: 'var(--os-bg)' }}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--os-border)' }}>
          <div>
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--os-text)' }}>3D Ocean Visualization</h2>
            <p className="text-[11px]" style={{ color: 'var(--os-text-3)' }}>
              {selectedLocation.latitude.toFixed(2)}° {selectedLocation.latitude >= 0 ? 'N' : 'S'},{' '}
              {selectedLocation.longitude.toFixed(2)}° {selectedLocation.longitude >= 0 ? 'E' : 'W'}
              {unit && <span className="ml-2 text-cyan-400">• {selectedVariable} ({unit})</span>}
            </p>
          </div>
          <button
            onClick={() => setIsModelViewOpen(false)}
            className="p-2 transition"
            style={{ color: 'var(--os-text-3)' }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Controls sidebar */}
          <div className="w-64 border-r p-4 overflow-y-auto" style={{ borderColor: 'var(--os-border)' }}>
            <DepthControl />
            <div className="mt-4">
              <VariableControls />
            </div>
            <div className="mt-4">
              <LayerControls />
            </div>
          </div>

          {/* Main visualization area */}
          <div className="flex-1 relative overflow-hidden">
            {/* Layer tabs */}
            <div className="absolute left-4 top-4 z-10 flex gap-2">
              {(['surface', 'depth', 'profile'] as const).map((layer) => (
                <button
                  key={layer}
                  className="px-3 py-1 text-[11px] font-medium"
                  style={{ background: 'var(--os-surface-2)', color: 'var(--os-text-3)', border: '1px solid var(--os-border)' }}
                >
                  {layer === 'surface' ? 'Surface Layer' : layer === 'depth' ? 'Depth Slices' : 'Vertical Profile'}
                </button>
              ))}
            </div>

            {/* Visualization content */}
            <div className="h-full w-full overflow-y-auto" style={{ background: 'var(--os-bg)' }}>
              {loading && (
                <div className="flex h-full items-center justify-center">
                  <LoadingState message="Loading HYCOM visualization data..." />
                </div>
              )}
              {error && !loading && (
                <div className="flex h-full items-center justify-center p-8">
                  <ErrorState message={error} />
                </div>
              )}
              {!loading && !error && (
                <div className="p-6 pt-16">
                  {/* Surface Layer */}
                  <SurfaceLayerViz data={surfaceGrid} unit={unit} />

                  {/* Depth Slices */}
                  <div className="mt-8">
                    <DepthSliceViz data={depthSlices} />
                  </div>

                  {/* Vertical Profile */}
                  <div className="mt-8">
                    <ProfileViz data={profileChart} unit={unit} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



// ── Visualization sub-components using real API data ──────────────────────────

function SurfaceLayerViz({ data, unit }: { data: SurfaceGridCell[]; unit: string }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-xs" style={{ color: 'var(--os-text-3)' }}>No surface layer data available</p>
      </div>
    );
  }

  // Group by latitude to form rows
  const lats = [...new Set(data.map((p) => p.latitude))].sort((a, b) => b - a);
  const lons = [...new Set(data.map((p) => p.longitude))].sort((a, b) => a - b);

  const getValue = (lat: number, lon: number) =>
    data.find((p) => p.latitude === lat && p.longitude === lon)?.value ?? null;

  const values = data.map((p) => p.value).filter((v): v is number => v !== null && v !== undefined);
  const minVal = values.length > 0 ? Math.min(...values) : 0;
  const maxVal = values.length > 0 ? Math.max(...values) : 1;
  const range = maxVal - minVal || 1;

  const getColor = (val: number | null) => {
    if (val === null) return '#1e293b';
    const normalized = (val - minVal) / range;
    const hue = (1 - normalized) * 240;
    return `hsl(${hue}, 80%, ${30 + normalized * 20}%)`;
  };

  return (
    <div>
      <h3 className="mb-2 text-[13px] font-medium" style={{ color: 'var(--os-text)' }}>Surface Layer</h3>
      <div className="inline-block border p-3" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
        <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${lons.length}, 1fr)` }}>
          {lats.map((lat) =>
            lons.map((lon) => {
              const val = getValue(lat, lon);
              return (
                <div
                  key={`${lat}-${lon}`}
                  className="h-8 w-8 transition-colors duration-200 hover:ring-2 hover:ring-white/30"
                  style={{ backgroundColor: getColor(val) }}
                  title={`${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E\n${val !== null ? `${val.toFixed(2)} ${unit}` : 'Land'}`}
                />
              );
            })
          )}
        </div>
        {/* Color scale */}
        <div className="mt-2 flex items-center justify-between text-[9px]" style={{ color: 'var(--os-text-3)' }}>
          <span>{minVal.toFixed(1)} {unit}</span>
          <div className="mx-2 h-1.5 flex-1" style={{ background: 'linear-gradient(to right, var(--os-diff-neg), var(--os-text-3) 50%, var(--os-diff-pos))' }} />
          <span>{maxVal.toFixed(1)} {unit}</span>
        </div>
      </div>
      <p className="mt-2 text-[10px]" style={{ color: 'var(--os-text-3)' }}>
        HYCOM surface grid — {data.length} points — {unit}
      </p>
    </div>
  );
}

function DepthSliceViz({ data }: { data: DepthSliceDisplay[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center">
        <p className="text-xs" style={{ color: 'var(--os-text-3)' }}>No depth slice data available</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-2 text-[13px] font-medium" style={{ color: 'var(--os-text)' }}>Depth Slices</h3>
      <div className="flex flex-col gap-2 max-w-md">
        {data.map((slice) => {
          const hue = slice.percentage > 0 ? ((100 - slice.percentage) / 100) * 240 : 200;
          return (
            <div key={slice.depth} className="flex items-center gap-3">
              <span className="w-16 text-right text-[10px]" style={{ color: 'var(--os-text-3)' }}>{slice.depth}m</span>
              <div className="flex-1 h-6 relative overflow-hidden" style={{ background: 'var(--os-surface-2)' }}>
                <div
                  className="absolute inset-y-0 left-0 rounded transition-all duration-500"
                  style={{
                    width: `${slice.percentage}%`,
                    background: `hsl(${hue}, 70%, 40%)`,
                  }}
                />
              </div>
              <span className="w-20 text-[10px]" style={{ color: 'var(--os-text-2)' }}>{slice.meanValue.toFixed(2)} {slice.unit}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px]" style={{ color: 'var(--os-text-3)' }}>
        HYCOM depth levels — {data.length} slices
      </p>
    </div>
  );
}

function ProfileViz({ data, unit }: { data: ProfileChartPoint[]; unit: string }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center">
        <p className="text-xs" style={{ color: 'var(--os-text-3)' }}>No profile data available</p>
      </div>
    );
  }

  // Build SVG chart
  const maxDepth = Math.max(...data.map((p) => p.depth));
  const allValues = data.flatMap((p) => [p.modelValue, p.observationValue]);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const valRange = maxVal - minVal || 1;

  const chartW = 300;
  const chartH = 200;
  const padL = 40;
  const padR = 20;
  const padT = 10;
  const padB = 30;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const toX = (val: number) => padL + ((val - minVal) / valRange) * plotW;
  const toY = (depth: number) => padT + (depth / maxDepth) * plotH;

  const modelPoints = data.map((p) => `${toX(p.modelValue)},${toY(p.depth)}`).join(' ');
  const obsPoints = data
    .filter((p) => p.observationValue !== 0)
    .map((p) => `${toX(p.observationValue)},${toY(p.depth)}`)
    .join(' ');

  // Depth axis ticks
  const depthTicks = [0, 100, 200, 300, 400, 500].filter((d) => d <= maxDepth);

  return (
    <div>
      <h3 className="mb-2 text-[13px] font-medium" style={{ color: 'var(--os-text)' }}>Vertical Profile</h3>
      <div className="inline-block border p-4" style={{ borderColor: 'var(--os-border)', background: 'var(--os-surface)' }}>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="h-48 w-full">
          {/* Grid lines */}
          {depthTicks.map((d) => (
            <g key={d}>
              <line x1={padL} y1={toY(d)} x2={chartW - padR} y2={toY(d)} stroke="var(--os-border)" strokeWidth="0.5" />
              <text x={padL - 4} y={toY(d) + 3} textAnchor="end" fill="var(--os-text-3)" fontSize="8">
                {d}m
              </text>
            </g>
          ))}

          {/* Model line */}
          {modelPoints && (
            <polyline
              points={modelPoints}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2"
            />
          )}

          {/* Observation line (dashed) */}
          {obsPoints && (
            <polyline
              points={obsPoints}
              fill="none"
              stroke="#a855f7"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
          )}

          {/* Data points */}
          {data.map((p, i) => (
            <circle key={i} cx={toX(p.modelValue)} cy={toY(p.depth)} r="2" fill="#06b6d4" />
          ))}
          {data
            .filter((p) => p.observationValue !== 0)
            .map((p, i) => (
              <circle key={`obs-${i}`} cx={toX(p.observationValue)} cy={toY(p.depth)} r="2" fill="#a855f7" />
            ))}

          {/* Legend */}
          <line x1={padL + 10} y1={chartH - 8} x2={padL + 30} y2={chartH - 8} stroke="#06b6d4" strokeWidth="2" />
          <text x={padL + 34} y={chartH - 5} fill="var(--os-text-2)" fontSize="8">Model</text>
          <line x1={padL + 80} y1={chartH - 8} x2={padL + 100} y2={chartH - 8} stroke="#a855f7" strokeWidth="2" strokeDasharray="4 2" />
          <text x={padL + 104} y={chartH - 5} fill="var(--os-text-2)" fontSize="8">Obs</text>
        </svg>
      </div>
      <p className="mt-2 text-[10px]" style={{ color: 'var(--os-text-3)' }}>
        HYCOM vertical profile — {data.length} depth levels — {unit}
      </p>
    </div>
  );
}
