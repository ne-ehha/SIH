export function formatLatitude(lat: number): string {
  const direction = lat >= 0 ? 'N' : 'S';
  return `${Math.abs(lat).toFixed(2)}° ${direction}`;
}

export function formatLongitude(lng: number): string {
  const direction = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lng).toFixed(2)}° ${direction}`;
}

export function formatDepth(depth: number): string {
  return `${depth} m`;
}

export function formatTemperature(temp: number): string {
  return `${temp.toFixed(2)} °C`;
}

export function formatSalinity(salinity: number): string {
  return `${salinity.toFixed(2)} PSU`;
}

export function formatCurrent(value: number): string {
  return `${value.toFixed(3)} m/s`;
}

export function isInBounds(
  lat: number,
  lng: number,
  bounds: { north: number; south: number; east: number; west: number }
): boolean {
  return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
}

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
