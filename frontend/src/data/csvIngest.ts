/**
 * Delimited-text (CSV) ingestion (SIH26067 Priority 8).
 *
 * Parses user-supplied delimited scientific observation data into the
 * canonical OceanDataRecord shape so it flows through the same registry /
 * capability / visualization architecture as the built-in sources.
 *
 * DESIGN RULES:
 *  - Parsed values are user data, clearly labelled with their declared
 *    source; they are never presented as OceanScope measurements.
 *  - No value imputation: rows failing validation are reported, not fixed.
 *  - Units and QC flags pass through untouched.
 */

import type { OceanDataRecord } from '@/types/canonical';

export interface CsvColumnMapping {
  /** Column header containing the ISO timestamp */
  time: string;
  latitude: string;
  longitude: string;
  /** Optional depth column (m) */
  depth?: string;
  /** Optional pressure column (dbar) — preferred vertical coordinate for Argo-like data */
  pressure?: string;
  /** One value column per variable (header → canonical variable id) */
  values: Record<string, string>;
  /** Optional QC flag column */
  qualityFlag?: string;
  /** Optional platform/station identifier column */
  platform?: string;
}

export interface CsvIngestResult {
  records: OceanDataRecord[];
  /** Rows skipped with reasons (row number + issue) — never silently dropped */
  rejected: Array<{ row: number; reason: string }>;
  /** Column headers detected in the file */
  headers: string[];
  delimiter: string;
}

/** Detect the delimiter from the header line (comma, semicolon, tab, pipe). */
export function detectDelimiter(line: string): string {
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestCount = 0;
  for (const c of candidates) {
    const count = line.split(c).length - 1;
    if (count > bestCount) {
      best = c;
      bestCount = count;
    }
  }
  return best;
}

function splitDelimited(line: string, delimiter: string): string[] {
  // Respect simple double-quoted fields; scientific CSVs rarely need more.
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const DEFAULT_UNITS: Record<string, string> = {
  temperature: '°C',
  salinity: 'PSU',
  pressure: 'dbar',
  currents_u: 'm/s',
  currents_v: 'm/s',
  chlorophyll: 'mg/m³',
};

/**
 * Parse delimited text into canonical records.
 *
 * @param text Raw file contents
 * @param sourceId Declared source id for provenance (e.g. 'csv-user-ctd')
 * @param mapping Column mapping describing the file layout
 */
export function parseDelimitedObservations(
  text: string,
  sourceId: string,
  mapping: CsvColumnMapping,
): CsvIngestResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return { records: [], rejected: [], headers: [], delimiter: ',' };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitDelimited(lines[0], delimiter);
  const indexOf = (col?: string) => (col ? headers.indexOf(col) : -1);

  const idxTime = indexOf(mapping.time);
  const idxLat = indexOf(mapping.latitude);
  const idxLon = indexOf(mapping.longitude);
  const idxDepth = indexOf(mapping.depth);
  const idxPressure = indexOf(mapping.pressure);
  const idxQc = indexOf(mapping.qualityFlag);
  const idxPlatform = indexOf(mapping.platform);

  const records: OceanDataRecord[] = [];
  const rejected: Array<{ row: number; reason: string }> = [];

  if (idxTime < 0 || idxLat < 0 || idxLon < 0) {
    return { records, rejected: [{ row: 1, reason: 'Missing required time/latitude/longitude column mapping' }], headers, delimiter };
  }

  for (let row = 1; row < lines.length; row++) {
    const cells = splitDelimited(lines[row], delimiter);
    const fail = (reason: string) => rejected.push({ row: row + 1, reason });

    const time = cells[idxTime];
    const lat = Number(cells[idxLat]);
    const lon = Number(cells[idxLon]);

    if (!time || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      fail('Invalid or missing time/latitude/longitude');
      continue;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      fail('Latitude/longitude out of physical range');
      continue;
    }
    if (idxPressure >= 0 && !Number.isFinite(Number(cells[idxPressure]))) {
      fail('Invalid pressure value');
      continue;
    }
    if (idxDepth >= 0 && !Number.isFinite(Number(cells[idxDepth]))) {
      fail('Invalid depth value');
      continue;
    }

    const base = {
      source: sourceId,
      sourceType: 'observation' as const,
      dataset: sourceId,
      platform: idxPlatform >= 0 ? cells[idxPlatform] : undefined,
      time,
      latitude: lat,
      longitude: lon,
      depth: idxDepth >= 0 ? Number(cells[idxDepth]) : undefined,
      pressure: idxPressure >= 0 ? Number(cells[idxPressure]) : undefined,
      qualityFlag: idxQc >= 0 ? cells[idxQc] : undefined,
      qcConvention: 'source-native',
    };

    let wroteAny = false;
    for (const [variable, col] of Object.entries(mapping.values)) {
      const idx = headers.indexOf(col);
      if (idx < 0) continue;
      const raw = cells[idx];
      if (raw === undefined || raw === '' ) {
        // Missing values are preserved as absent — never imputed.
        continue;
      }
      const value = Number(raw);
      if (!Number.isFinite(value)) {
        fail(`Non-numeric ${variable} value "${raw}"`);
        continue;
      }
      records.push({
        ...base,
        variable,
        value,
        units: DEFAULT_UNITS[variable] ?? '',
      });
      wroteAny = true;
    }
    if (!wroteAny) {
      // Only reject when nothing parseable was written for the row.
      if (Object.values(mapping.values).some((c) => headers.indexOf(c) >= 0)) {
        fail('No valid measurement value in row');
      }
    }
  }

  return { records, rejected, headers, delimiter };
}

/**
 * Download a CSV ingestion template reflecting the canonical schema.
 * Helps users prepare files that map cleanly onto OceanDataRecord.
 */
export function ingestionTemplateCsv(): string {
  return [
    '# OceanScope delimited-text ingestion template',
    '# Fill one row per measurement; leave a value empty when not measured (never zero-fill).',
    '',
    ['time', 'latitude', 'longitude', 'pressure', 'depth', 'platform', 'temperature', 'salinity', 'quality_flag'].join(','),
    '2024-01-10T12:00:00Z,12.5000,86.5000,10.00,9.9,MY-CTD-01,28.1234,34.5678,1',
    '2024-01-10T12:00:00Z,12.5000,86.5000,50.00,49.5,MY-CTD-01,27.4321,34.9876,1',
  ].join('\n');
}
