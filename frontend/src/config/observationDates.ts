/**
 * Canonical observation dates.
 *
 * These are the only dates with real records in
 * glorys_argo_collocation_2024.nc (daily nearest-neighbour collocation,
 * 0.25° grid). Dates without observations MUST NOT appear in time
 * controls — never imply observations exist for missing dates.
 *
 * Mirrors ARGO_TEMPORAL_DATES in backend/app/config.py.
 */
export const OBSERVATION_DATES: readonly string[] = [
  '2024-01-01',
  '2024-01-04',
  '2024-01-06',
  '2024-01-07',
  '2024-01-08',
  '2024-01-09',
  '2024-01-10',
  '2024-01-11',
  '2024-01-14',
] as const;

/** Human-readable label for an ISO date, e.g. "2024-01-10" → "10 Jan 2024". */
export function observationDateLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[parseInt(m, 10) - 1] ?? m;
  return `${d} ${month} 2024`;
}
