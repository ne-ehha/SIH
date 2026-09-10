import { useMemo, useState } from 'react';
import { useOceanStore } from '@/state/oceanStore';
import { useResearchVisualization3D, type Research3DPoint } from '@/integration';
import { valueToColor, paletteGradient, logScaleAvailable } from '@/config/colorScales';
import { OBSERVATION_DATES } from '@/config/observationDates';
import {
  findNearestResearchMeasurement,
  RESEARCH_NEAREST_MATCH_TOLERANCE,
} from '@/integration/researchSelection';
import { regions } from '@/config/regions';
import { formatLatitude, formatLongitude } from '@/utils/coordinates';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';

const DEPTH_MIN = 0;
const DEPTH_MAX = 500;
const DEPTH_COVERAGE_TICKS = [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500] as const;

const MAP_WIDTH = 720;
const MAP_HEIGHT = 440;
const MAP_PAD_L = 42;
const MAP_PAD_R = 18;
const MAP_PAD_T = 30;
const MAP_PAD_B = 34;

type Bounds = { north: number; south: number; east: number; west: number };

function isComparisonVariable(variable: string): variable is 'temperature' | 'salinity' {
  return variable === 'temperature' || variable === 'salinity';
}

function observationIdFromPoint(point: Research3DPoint): string {
  const cycle = Math.trunc(parseFloat(point.cycleNumber));
  return `argo_${point.platformNumber}_${Number.isFinite(cycle) ? cycle : point.cycleNumber}`;
}

function profileKey(point: Research3DPoint): string {
  return `${point.platformNumber}|${parseFloat(point.cycleNumber)}`;
}

function groupByProfile(points: Research3DPoint[]): Map<string, Research3DPoint[]> {
  const byProfile = new Map<string, Research3DPoint[]>();
  for (const point of points) {
    const key = profileKey(point);
    const group = byProfile.get(key);
    if (group) group.push(point);
    else byProfile.set(key, [point]);
  }
  return byProfile;
}

function depthFilterCollocations(
  points: Research3DPoint[],
  selectedDepth: number,
): Research3DPoint[] {
  const filtered: Research3DPoint[] = [];
  for (const profilePoints of groupByProfile(points).values()) {
    const nearest = findNearestResearchMeasurement(profilePoints, selectedDepth);
    if (nearest) filtered.push(nearest);
  }
  return filtered;
}

function computeSignedStats(points: Research3DPoint[]) {
  if (points.length === 0) {
    return { validCount: 0, meanDifference: 0, rmsDifference: 0, maxAbsDifference: 0 };
  }
  const diffs = points.map((p) => p.difference);
  const meanDifference = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
  const rmsDifference = Math.sqrt(diffs.reduce((sum, d) => sum + d * d, 0) / diffs.length);
  const maxAbsDifference = Math.max(...diffs.map((d) => Math.abs(d)));
  return { validCount: points.length, meanDifference, rmsDifference, maxAbsDifference };
}

function buildDepthCoverage(points: Research3DPoint[]) {
  const profiles = [...groupByProfile(points).values()];
  return DEPTH_COVERAGE_TICKS.map((depth) => {
    let count = 0;
    for (const profilePoints of profiles) {
      if (findNearestResearchMeasurement(profilePoints, depth)) count += 1;
    }
    return { depth, count };
  });
}

function differenceFill(
  difference: number,
  scale: number,
): string {
  if (scale <= 0 || !Number.isFinite(scale)) return 'var(--os-text-3)';
  const t = Math.max(-1, Math.min(1, difference / scale));
  if (Math.abs(t) < 0.02) return 'var(--os-text-3)';
  if (t < 0) {
    const a = 0.45 + Math.abs(t) * 0.5;
    return `color-mix(in srgb, var(--os-diff-neg) ${Math.round(a * 100)}%, var(--os-surface))`;
  }
  const a = 0.45 + t * 0.5;
  return `color-mix(in srgb, var(--os-diff-pos) ${Math.round(a * 100)}%, var(--os-surface))`;
}

/**
 * Value→color mapping honouring the scientific color-scale controls
 * (palette / min / max / log). Diverging palettes center on zero;
 * the manual min/max widen or narrow the effective range.
 */
function controlledFill(
  difference: number,
  scale: number,
  config: { paletteId: string; auto: boolean; min: number; max: number; logarithmic: boolean },
): string {
  const magnitude = Math.abs(difference);
  const sign = difference >= 0 ? 1 : -1;
  // Effective half-range: manual values widen the scale beyond the data max;
  // non-finite or inverted manual ranges are ignored (renderer-side guard).
  const manualUsable =
    Number.isFinite(config.min) && Number.isFinite(config.max) && config.min < config.max;
  const halfRange = config.auto || !manualUsable
    ? scale
    : Math.max(Math.abs(config.min), Math.abs(config.max), scale);
  if (halfRange <= 0 || !Number.isFinite(halfRange)) return 'var(--os-text-3)';
  // A signed field is never log-mapped here: log requires a positive domain
  // and shifting data to force log is forbidden.
  return valueToColor(magnitude * sign, {
    paletteId: config.paletteId,
    min: -halfRange,
    max: halfRange,
    logarithmic: false,
  });
}

function projectPoint(latitude: number, longitude: number, bounds: Bounds) {
  const x =
    MAP_PAD_L +
    ((longitude - bounds.west) / Math.max(bounds.east - bounds.west, 1e-6)) *
      (MAP_WIDTH - MAP_PAD_L - MAP_PAD_R);
  const y =
    MAP_PAD_T +
    ((bounds.north - latitude) / Math.max(bounds.north - bounds.south, 1e-6)) *
      (MAP_HEIGHT - MAP_PAD_T - MAP_PAD_B);
  return { x, y };
}

function niceStep(span: number): number {
  if (span <= 6) return 1;
  if (span <= 12) return 2;
  if (span <= 30) return 5;
  return 10;
}

function graticuleLines(bounds: Bounds) {
  const latStep = niceStep(bounds.north - bounds.south);
  const lonStep = niceStep(bounds.east - bounds.west);
  const lats: number[] = [];
  const lons: number[] = [];
  const latStart = Math.ceil(bounds.south / latStep) * latStep;
  for (let lat = latStart; lat <= bounds.north + 1e-9; lat += latStep) {
    if (lat >= bounds.south && lat <= bounds.north) lats.push(lat);
  }
  const lonStart = Math.ceil(bounds.west / lonStep) * lonStep;
  for (let lon = lonStart; lon <= bounds.east + 1e-9; lon += lonStep) {
    if (lon >= bounds.west && lon <= bounds.east) lons.push(lon);
  }
  return { lats, lons };
}

function dataAwareBounds(points: Research3DPoint[], regionBounds: Bounds): Bounds {
  if (points.length === 0) return regionBounds;
  const lats = points.map((p) => p.latitude);
  const lons = points.map((p) => p.longitude);
  let south = Math.min(...lats);
  let north = Math.max(...lats);
  let west = Math.min(...lons);
  let east = Math.max(...lons);
  const latPad = Math.max((north - south) * 0.14, 0.7);
  const lonPad = Math.max((east - west) * 0.14, 0.7);
  south = Math.max(regionBounds.south, south - latPad);
  north = Math.min(regionBounds.north, north + latPad);
  west = Math.max(regionBounds.west, west - lonPad);
  east = Math.min(regionBounds.east, east + lonPad);
  if (north - south < 2) {
    const mid = (north + south) / 2;
    south = Math.max(regionBounds.south, mid - 1);
    north = Math.min(regionBounds.north, mid + 1);
  }
  if (east - west < 2) {
    const mid = (east + west) / 2;
    west = Math.max(regionBounds.west, mid - 1);
    east = Math.min(regionBounds.east, mid + 1);
  }
  return { north, south, east, west };
}

function selectObservation(
  point: Research3DPoint,
  fallbackDate: string,
  selectResearchObservation: (selection: {
    id: string;
    location: { latitude: number; longitude: number };
    date: string;
  }) => void,
) {
  const dateFromPoint = point.timestamp?.substring(0, 10);
  selectResearchObservation({
    id: observationIdFromPoint(point),
    location: { latitude: point.latitude, longitude: point.longitude },
    date: dateFromPoint || fallbackDate,
  });
}

function biasLabel(difference: number): 'MODEL LOW' | 'NEAR ZERO' | 'MODEL HIGH' {
  if (difference < 0) return 'MODEL LOW';
  if (difference > 0) return 'MODEL HIGH';
  return 'NEAR ZERO';
}

function cycleLabel(cycleNumber: string): string {
  const n = Math.trunc(parseFloat(cycleNumber));
  return Number.isFinite(n) ? String(n) : cycleNumber;
}

function toneClass(tone?: 'pos' | 'neg' | 'argo' | 'glorys'): string {
  if (tone === 'pos') return 'text-[var(--os-diff-pos)]';
  if (tone === 'neg') return 'text-[var(--os-diff-neg)]';
  if (tone === 'argo') return 'text-[var(--os-argo)]';
  if (tone === 'glorys') return 'text-[var(--os-glorys)]';
  return 'text-[var(--os-text)]';
}

export function DiscrepancyMap() {
  const {
    selectedLocation,
    selectedObservationId,
    selectedVariable,
    selectedDate,
    selectedTime,
    selectedDepth,
    selectedRegion,
    selectResearchObservation,
    colorScale,
    activeLayers,
    stepTime,
    timeIndex,
  } = useOceanStore();

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const comparisonVariable = isComparisonVariable(selectedVariable);
  const region = regions.find((r) => r.id === selectedRegion) ?? regions[0];

  const { points, selectedProfilePoints, unit, loading, error, refetch } =
    useResearchVisualization3D({
      latitude: selectedLocation?.latitude ?? null,
      longitude: selectedLocation?.longitude ?? null,
      variable: comparisonVariable ? selectedVariable : 'temperature',
      date: selectedDate,
      time: selectedTime,
      selectedObservationId,
      selectedDepth,
      enabled: comparisonVariable && selectedLocation !== null,
    });

  const mapPoints = useMemo(
    () => depthFilterCollocations(points, selectedDepth),
    [points, selectedDepth],
  );
  const stats = useMemo(() => computeSignedStats(mapPoints), [mapPoints]);
  const depthCoverage = useMemo(() => buildDepthCoverage(points), [points]);
  const mapBounds = useMemo(
    () => dataAwareBounds(mapPoints.length > 0 ? mapPoints : points, region.bounds),
    [mapPoints, points, region.bounds],
  );

  const selectedEvidence = useMemo(() => {
    if (!selectedObservationId) return null;
    const fromMap = mapPoints.find((p) => observationIdFromPoint(p) === selectedObservationId);
    if (fromMap) return fromMap;
    return findNearestResearchMeasurement(selectedProfilePoints, selectedDepth);
  }, [mapPoints, selectedObservationId, selectedProfilePoints, selectedDepth]);

  const largestAbsPoint = useMemo(() => {
    if (mapPoints.length === 0) return null;
    return mapPoints.reduce((best, point) =>
      Math.abs(point.difference) > Math.abs(best.difference) ? point : best,
    );
  }, [mapPoints]);

  const colorScaleValue = stats.maxAbsDifference > 0 ? stats.maxAbsDifference : 1;
  const displayUnit = unit || (selectedVariable === 'salinity' ? 'PSU' : '°C');
  const grid = graticuleLines(mapBounds);

  // Log-scale semantics for the SIGNED difference field: GLORYS − Argo spans
  // negative and positive values, so a strict log map is undefined. We never
  // shift data by an arbitrary constant — the renderer keeps linear mapping
  // and says so. (Manual min/max still widen the linear half-range below.)
  const logAvailable = logScaleAvailable(mapPoints.map((p) => p.difference));
  const logEffective = colorScale.logarithmic && logAvailable;
  const manualRangeInvalid =
    !colorScale.auto &&
    (colorScale.min >= colorScale.max || !Number.isFinite(colorScale.min) || !Number.isFinite(colorScale.max));

  // Layer manager: the discrepancy layer's visibility + opacity are real controls.
  const discrepancyLayer = activeLayers.find((l) => l.id === 'discrepancies');
  const discrepancyVisible = discrepancyLayer?.enabled ?? true;
  const discrepancyOpacity = discrepancyLayer?.opacity ?? 0.85;

  const currentCoverage = (() => {
    const exact = depthCoverage.find((d) => Math.abs(d.depth - selectedDepth) < 1e-6);
    if (exact) return exact;
    let nearest = depthCoverage[0];
    let dist = Math.abs(nearest.depth - selectedDepth);
    for (const row of depthCoverage) {
      const d = Math.abs(row.depth - selectedDepth);
      if (d < dist) {
        nearest = row;
        dist = d;
      }
    }
    return nearest;
  })();

  const maxCoverage = Math.max(1, ...depthCoverage.map((d) => d.count));
  const sliceIsSparse =
    currentCoverage.count === 0 ||
    currentCoverage.count < Math.max(2, Math.ceil(maxCoverage * 0.35));

  const handlePointClick = (point: Research3DPoint) => {
    selectObservation(point, selectedDate, selectResearchObservation);
  };

  const handleLargestDiscrepancy = () => {
    if (!largestAbsPoint) return;
    selectObservation(largestAbsPoint, selectedDate, selectResearchObservation);
  };

  return (
    <div className="border border-[var(--os-border)] bg-[var(--os-surface)]">
      {/* Compact COMPARE title — global strip owns investigation metadata */}
      <header className="border-b border-[var(--os-border)] px-3 py-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-[var(--os-text)]">
            Regional model–observation difference
          </div>
          <div className="text-[11px] text-[var(--os-text-2)] mt-0.5">
            GLORYS12V1 − Argo · collocated observations near {selectedDepth} m
          </div>
        </div>

        {/* Time navigation — real observation dates only (SIH26067) */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => stepTime(-1)}
            disabled={timeIndex <= 0}
            className="border border-[var(--os-border)] bg-[var(--os-bg)] px-2 py-1 text-[11px] transition hover:border-[var(--os-border-light)] disabled:opacity-30 disabled:cursor-not-allowed"
            title="Previous observation date"
          >
            ◀
          </button>
          <span className="mono text-[11px] px-1" style={{ color: 'var(--os-text-2)' }}>
            {selectedDate}
          </span>
          <button
            type="button"
            onClick={() => stepTime(1)}
            disabled={timeIndex >= OBSERVATION_DATES.length - 1}
            className="border border-[var(--os-border)] bg-[var(--os-bg)] px-2 py-1 text-[11px] transition hover:border-[var(--os-border-light)] disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next observation date"
          >
            ▶
          </button>
        </div>
        <button
          type="button"
          disabled={!largestAbsPoint}
          onClick={handleLargestDiscrepancy}
          className="shrink-0 border border-[var(--os-border)] bg-[var(--os-bg)] px-3 py-1.5 text-left transition hover:border-[var(--os-border-light)] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--os-text-3)]">
            Largest |Δ|
          </div>
          {largestAbsPoint ? (
            <div className={`mono text-[16px] font-medium mt-0.5 ${toneClass(largestAbsPoint.difference >= 0 ? 'pos' : 'neg')}`}>
              {Math.abs(largestAbsPoint.difference).toFixed(2)} {displayUnit}
            </div>
          ) : (
            <div className="text-[12px] text-[var(--os-text-3)] mt-0.5">—</div>
          )}
        </button>
      </header>

      <div className="p-3 space-y-3">
        {!comparisonVariable && (
          <EmptyState message="Comparison supports temperature and salinity only. Select a comparison variable in the sidebar." />
        )}
        {comparisonVariable && loading && (
          <LoadingState message="Loading collocated observations…" />
        )}
        {comparisonVariable && !loading && error && (
          <ErrorState message={error} onRetry={refetch} />
        )}
        {comparisonVariable && !loading && !error && points.length === 0 && (
          <EmptyState message="No collocated observations available for the current research date." />
        )}
        {comparisonVariable && !loading && !error && points.length > 0 && mapPoints.length === 0 && (
          <EmptyState
            message={`No real collocated observations within ${RESEARCH_NEAREST_MATCH_TOLERANCE} dbar of ${selectedDepth} m.`}
          />
        )}

        {comparisonVariable && !loading && !error && mapPoints.length > 0 && (
          <>
            {/* PRIMARY: map + selected evidence */}
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(260px,0.85fr)]">
              <div className="min-w-0 border border-[var(--os-border)] bg-[var(--os-bg)]">
                <svg
                  viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                  className="w-full h-auto block max-h-[min(52vh,460px)]"
                  role="img"
                  aria-label="Collocated observations bias map"
                >
                  <rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="var(--os-bg)" />
                  <rect
                    x={MAP_PAD_L}
                    y={MAP_PAD_T}
                    width={MAP_WIDTH - MAP_PAD_L - MAP_PAD_R}
                    height={MAP_HEIGHT - MAP_PAD_T - MAP_PAD_B}
                    fill="var(--os-surface)"
                    stroke="var(--os-border)"
                    strokeWidth={1}
                  />
                  {grid.lons.map((lon) => {
                    const a = projectPoint(mapBounds.north, lon, mapBounds);
                    const b = projectPoint(mapBounds.south, lon, mapBounds);
                    return (
                      <g key={`lon-${lon}`}>
                        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--os-border)" strokeWidth={0.55} strokeDasharray="2 3" />
                        <text x={b.x} y={MAP_HEIGHT - 10} fill="var(--os-text-3)" fontSize={10} fontFamily="ui-monospace, monospace" textAnchor="middle">
                          {lon.toFixed(0)}°E
                        </text>
                      </g>
                    );
                  })}
                  {grid.lats.map((lat) => {
                    const a = projectPoint(lat, mapBounds.west, mapBounds);
                    const b = projectPoint(lat, mapBounds.east, mapBounds);
                    return (
                      <g key={`lat-${lat}`}>
                        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--os-border)" strokeWidth={0.55} strokeDasharray="2 3" />
                        <text x={12} y={a.y + 3} fill="var(--os-text-3)" fontSize={10} fontFamily="ui-monospace, monospace">
                          {lat.toFixed(0)}°N
                        </text>
                      </g>
                    );
                  })}
                  <text x={MAP_PAD_L + 8} y={MAP_PAD_T - 10} fill="var(--os-text)" fontSize={12} fontWeight={600} letterSpacing="0.04em">
                    COLLOCATED OBSERVATIONS
                  </text>
                  <text x={MAP_WIDTH - MAP_PAD_R} y={MAP_PAD_T - 10} fill="var(--os-text-3)" fontSize={11} fontFamily="ui-monospace, monospace" textAnchor="end">
                    {mapPoints.length} real profiles · GLORYS − Argo
                  </text>
                  {discrepancyVisible && mapPoints.map((point) => {
                    const { x, y } = projectPoint(point.latitude, point.longitude, mapBounds);
                    const id = observationIdFromPoint(point);
                    const selected = id === selectedObservationId;
                    const hovered = id === hoveredId;
                    const isLargest =
                      largestAbsPoint !== null && observationIdFromPoint(largestAbsPoint) === id;
                    const radius = selected ? 7.5 : hovered ? 6.5 : isLargest ? 5.8 : 4.5;
                    return (
                      <circle
                        key={id}
                        cx={x}
                        cy={y}
                        r={radius}
                        fillOpacity={discrepancyOpacity}
                        fill={controlledFill(point.difference, colorScaleValue, colorScale)}
                        stroke={
                          selected
                            ? 'var(--os-selected)'
                            : hovered
                              ? 'var(--os-text)'
                              : isLargest
                                ? 'var(--os-text-2)'
                                : 'var(--os-border-light)'
                        }
                        strokeWidth={selected ? 1.8 : hovered ? 1.2 : 0.75}
                        opacity={selected || hovered || !hoveredId ? 1 : 0.7}
                        className="cursor-pointer"
                        onClick={() => handlePointClick(point)}
                        onMouseEnter={() => setHoveredId(id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        <title>{`${formatLatitude(point.latitude)} ${formatLongitude(point.longitude)} · Δ ${point.difference > 0 ? '+' : ''}${point.difference.toFixed(4)} ${displayUnit}`}</title>
                      </circle>
                    );
                  })}
                </svg>                  <div className="border-t border-[var(--os-border)] px-3 py-2">
                  <div className="relative h-2.5 border border-[var(--os-border)] bg-[var(--os-surface-2)]">
                    <div
                      className="absolute inset-0"
                      style={{
                        background: paletteGradient(
                          colorScale.paletteId,
                          logEffective,
                          -colorScaleValue,
                          colorScaleValue,
                        ),
                        opacity: 0.92,
                      }}
                    />
                    <div className="absolute top-[-3px] bottom-[-3px] w-px bg-[var(--os-text)]" style={{ left: '50%' }} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px]">
                    <span className="text-[var(--os-diff-neg)] font-medium">MODEL LOW</span>
                    <span className="text-[var(--os-text-2)] mono">
                      ZERO · ±{colorScaleValue.toFixed(2)} {displayUnit}
                      {logEffective ? ' · log' : ''}
                      {colorScale.logarithmic && !logAvailable ? ' · log unavailable (signed values)' : ''}
                      {!colorScale.auto
                        ? ` · manual [${colorScale.min}, ${colorScale.max}]${manualRangeInvalid ? ' (invalid — ignored)' : ''}`
                        : ''}
                    </span>
                    <span className="text-[var(--os-diff-pos)] font-medium">MODEL HIGH</span>
                  </div>
                </div>
              </div>

              {/* Selected evidence — Δ is the focal point */}
              <section className="min-w-0 border border-[var(--os-border)] bg-[var(--os-bg)]">
                <div className="border-b border-[var(--os-border)] px-3 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--os-text-2)]">
                    Selected evidence
                  </span>
                </div>
                <div className="p-3">
                  {!selectedObservationId && (
                    <p className="text-[12px] text-[var(--os-text-2)] leading-relaxed">
                      Click a collocated observation on the map to inspect Argo vs GLORYS12V1 at this depth.
                    </p>
                  )}
                  {selectedObservationId && !selectedEvidence && (
                    <p className="text-[12px] text-[var(--os-text-2)] leading-relaxed">
                      No real measurement within {RESEARCH_NEAREST_MATCH_TOLERANCE} dbar of {selectedDepth} m
                      for the selected profile.
                    </p>
                  )}
                  {selectedEvidence && (
                    <div>
                      <div
                        className={`text-[12px] font-semibold tracking-wide ${toneClass(
                          selectedEvidence.difference > 0
                            ? 'pos'
                            : selectedEvidence.difference < 0
                              ? 'neg'
                              : undefined,
                        )}`}
                      >
                        {biasLabel(selectedEvidence.difference)}
                      </div>
                      <div
                        className={`mono text-[20px] font-semibold mt-1 ${toneClass(
                          selectedEvidence.difference > 0
                            ? 'pos'
                            : selectedEvidence.difference < 0
                              ? 'neg'
                              : undefined,
                        )}`}
                      >
                        {selectedEvidence.difference > 0 ? '+' : ''}
                        {selectedEvidence.difference.toFixed(2)} {displayUnit}
                      </div>
                      <div className="text-[11px] text-[var(--os-text-3)] mt-0.5">GLORYS − Argo</div>

                      <div className="mt-4 space-y-2">
                        <ValueBlock
                          label="Argo"
                          value={`${selectedEvidence.argoValue.toFixed(2)} ${displayUnit}`}
                          tone="argo"
                        />
                        <ValueBlock
                          label="GLORYS12V1"
                          value={`${selectedEvidence.glorysValue.toFixed(2)} ${displayUnit}`}
                          tone="glorys"
                        />
                      </div>

                      <div className="mt-4 pt-3 border-t border-[var(--os-border)] space-y-1.5 text-[12px]">
                        <div className="mono text-[var(--os-text)]">
                          ARGO {selectedEvidence.platformNumber} / C{cycleLabel(selectedEvidence.cycleNumber)}
                        </div>
                        <div className="text-[var(--os-text-2)]">
                          {formatLatitude(selectedEvidence.latitude)} ·{' '}
                          {formatLongitude(selectedEvidence.longitude)}
                        </div>
                        <div className="text-[var(--os-text-2)] mono">
                          {selectedEvidence.pressure.toFixed(1)} dbar
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Regional stats — dominant readings */}
            <section className="border border-[var(--os-border)] bg-[var(--os-bg)]">
              <div className="grid grid-cols-2 sm:grid-cols-4">
                <StatBlock
                  label="Mean Δ"
                  value={`${stats.meanDifference > 0 ? '+' : ''}${stats.meanDifference.toFixed(2)} ${displayUnit}`}
                  tone={stats.meanDifference > 0 ? 'pos' : stats.meanDifference < 0 ? 'neg' : undefined}
                />
                <StatBlock label="RMS" value={`${stats.rmsDifference.toFixed(2)} ${displayUnit}`} />
                <StatBlock label="Max |Δ|" value={`${stats.maxAbsDifference.toFixed(2)} ${displayUnit}`} />
                <StatBlock label="Valid" value={String(stats.validCount)} />
              </div>
              <p className="px-3 py-2 text-[11px] text-[var(--os-text-3)] border-t border-[var(--os-border)]">
                Statistics use only the {stats.validCount} collocated observations plotted above
                (nearest real level to {selectedDepth} m, ≤{RESEARCH_NEAREST_MATCH_TOLERANCE} dbar).
                Positive Δ = MODEL HIGH.
              </p>
            </section>

            {/* Depth behaviour + profile bias */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <section className="border border-[var(--os-border)] bg-[var(--os-bg)] min-w-0">
                <div className="border-b border-[var(--os-border)] px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[var(--os-text)]">Depth behaviour</span>
                  <span
                    className={`mono text-[12px] ${
                      sliceIsSparse ? 'text-[var(--os-diff-pos)]' : 'text-[var(--os-text-2)]'
                    }`}
                  >
                    {currentCoverage.count} profiles @ {selectedDepth} m
                    {sliceIsSparse ? ' · sparse' : ''}
                  </span>
                </div>
                <div className="px-3 py-2">
                  <DepthCoverageChart
                    rows={depthCoverage}
                    selectedDepth={selectedDepth}
                    maxCount={maxCoverage}
                  />
                  <p className="mt-2 text-[11px] text-[var(--os-text-3)]">
                    Real profiles with a usable level near each tick ({DEPTH_MIN}–{DEPTH_MAX} m).
                  </p>
                </div>
              </section>

              <section className="border border-[var(--os-border)] bg-[var(--os-bg)] min-w-0">
                <div className="border-b border-[var(--os-border)] px-3 py-2">
                  <span className="text-[12px] font-semibold text-[var(--os-text)]">Profile bias</span>
                  <span className="ml-2 text-[11px] text-[var(--os-text-3)]">
                    Does bias change with depth?
                  </span>
                </div>
                <div className="px-3 py-2">
                  <ProfileBiasPlot
                    points={selectedProfilePoints}
                    selectedPressure={selectedEvidence?.pressure ?? null}
                    selectedDepth={selectedDepth}
                    unit={displayUnit}
                  />
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'pos' | 'neg';
}) {
  return (
    <div className="px-3 py-3 border-r border-[var(--os-border)] last:border-r-0 min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--os-text-3)]">
        {label}
      </div>
      <div className={`mono text-[18px] font-semibold mt-1 truncate ${toneClass(tone)}`}>{value}</div>
    </div>
  );
}

function ValueBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'argo' | 'glorys';
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--os-text-3)]">
        {label}
      </span>
      <span className={`mono text-[16px] font-medium ${toneClass(tone)}`}>{value}</span>
    </div>
  );
}

function DepthCoverageChart({
  rows,
  selectedDepth,
  maxCount,
}: {
  rows: Array<{ depth: number; count: number }>;
  selectedDepth: number;
  maxCount: number;
}) {
  const width = 640;
  const height = 72;
  const padL = 8;
  const padR = 8;
  const padT = 8;
  const padB = 20;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const barW = innerW / rows.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto block" aria-label="Depth coverage">
      {rows.map((row, i) => {
        const h = maxCount > 0 ? (row.count / maxCount) * innerH : 0;
        const x = padL + i * barW;
        const y = padT + innerH - h;
        const active = Math.abs(row.depth - selectedDepth) <= 25;
        return (
          <g key={row.depth}>
            <rect
              x={x + 2}
              y={y}
              width={Math.max(barW - 4, 1)}
              height={Math.max(h, row.count > 0 ? 1 : 0)}
              fill={active ? 'var(--os-accent)' : 'var(--os-border-light)'}
              opacity={row.count === 0 ? 0.22 : active ? 0.95 : 0.65}
            />
            <text
              x={x + barW / 2}
              y={height - 4}
              fill={active ? 'var(--os-text)' : 'var(--os-text-3)'}
              fontSize={10}
              fontFamily="ui-monospace, monospace"
              textAnchor="middle"
            >
              {row.depth}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ProfileBiasPlot({
  points,
  selectedPressure,
  selectedDepth,
  unit,
}: {
  points: Research3DPoint[];
  selectedPressure: number | null;
  selectedDepth: number;
  unit: string;
}) {
  if (points.length === 0) {
    return (
      <EmptyState message="Select a collocated observation with vertical levels to view profile bias." />
    );
  }

  const width = 340;
  const height = 200;
  const padL = 42;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const sorted = [...points].sort((a, b) => a.pressure - b.pressure);
  const diffs = sorted.map((p) => p.difference);
  const maxAbs = Math.max(...diffs.map((d) => Math.abs(d)), 1e-6);
  const pressures = sorted.map((p) => p.pressure);
  const pMin = Math.min(...pressures);
  const pMax = Math.max(...pressures);

  const xOf = (d: number) => padL + ((d + maxAbs) / (2 * maxAbs)) * innerW;
  const yOf = (p: number) => padT + ((p - pMin) / Math.max(pMax - pMin, 1e-6)) * innerH;
  const zeroX = xOf(0);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto block" aria-label="Profile bias">
        <rect x={0} y={0} width={width} height={height} fill="var(--os-bg)" />
        <line x1={zeroX} y1={padT} x2={zeroX} y2={padT + innerH} stroke="var(--os-text-3)" strokeWidth={1} />
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="var(--os-border)" strokeWidth={1} />
        <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="var(--os-border)" strokeWidth={1} />
        <text x={padL} y={height - 8} fill="var(--os-text-3)" fontSize={10} fontFamily="ui-monospace, monospace" textAnchor="middle">
          −{maxAbs.toFixed(2)}
        </text>
        <text x={zeroX} y={height - 8} fill="var(--os-text-2)" fontSize={10} fontFamily="ui-monospace, monospace" textAnchor="middle">
          0
        </text>
        <text x={padL + innerW} y={height - 8} fill="var(--os-text-3)" fontSize={10} fontFamily="ui-monospace, monospace" textAnchor="middle">
          +{maxAbs.toFixed(2)}
        </text>
        <text x={8} y={padT + 8} fill="var(--os-text-3)" fontSize={10} fontFamily="ui-monospace, monospace">
          {pMin.toFixed(0)}
        </text>
        <text x={8} y={padT + innerH} fill="var(--os-text-3)" fontSize={10} fontFamily="ui-monospace, monospace">
          {pMax.toFixed(0)}
        </text>
        {sorted.map((point) => {
          const x = xOf(point.difference);
          const y = yOf(point.pressure);
          const active =
            selectedPressure !== null && Math.abs(point.pressure - selectedPressure) < 1e-6;
          return (
            <g key={`${point.pressure}-${point.difference}`}>
              <line
                x1={zeroX}
                y1={y}
                x2={x}
                y2={y}
                stroke={point.difference >= 0 ? 'var(--os-diff-pos)' : 'var(--os-diff-neg)'}
                strokeWidth={active ? 1.6 : 0.8}
                opacity={active ? 1 : 0.55}
              />
              <circle
                cx={x}
                cy={y}
                r={active ? 3.6 : 2.2}
                fill={point.difference >= 0 ? 'var(--os-diff-pos)' : 'var(--os-diff-neg)'}
                stroke={active ? 'var(--os-selected)' : 'transparent'}
                strokeWidth={1.3}
              />
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[11px] text-[var(--os-text-3)]">
        X: GLORYS − Argo ({unit}) · Y: depth ↓ · {sorted.length} real levels · slider {selectedDepth} m
      </p>
    </div>
  );
}
