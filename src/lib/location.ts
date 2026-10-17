export type Coords = { lat: number; lng: number };
export const DELIVERY_RADIUS_M = 200; // delivery person must be this close to mark as delivered (server allows 300 m for GPS error)

export function getCurrentCoords(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('This browser cannot read your location.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(new Error(e.code === 1 ? 'Location permission was denied. Allow it in the browser site settings.' : e.message || 'Could not get your location. Turn on GPS and try again.')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
    );
  });
}

export function distanceM(a: Coords, b: Coords) {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}
export const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

// Reads "26.9124,75.7873" or a full Google Maps link that contains the pin
const N = '(-?\\d{1,3}(?:\\.\\d+)?)';
const PATTERNS = [
  new RegExp(`@${N},${N}`),
  new RegExp(`[?&](?:q|ll|query|destination|center)=${N}(?:,|%2C)${N}`),
  new RegExp(`!3d${N}!4d${N}`),
  new RegExp(`^\\s*${N}\\s*,\\s*${N}\\s*$`),
];
export function parseLocation(text: string): Coords | null {
  for (const re of PATTERNS) {
    const m = text.match(re);
    if (m) {
      const lat = +m[1], lng = +m[2];
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}
const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
// NOTE: short links (maps.app.goo.gl) cannot be opened from a browser (CORS), so only full links and "lat,lng" work on web.
export async function resolveLocation(text: string): Promise<Coords | null> {
  return parseLocation(text.trim()) ?? parseLocation(safeDecode(text.trim()));
}

export const mapsUrl = (c: Coords) => `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
export const directionsUrl = (c: Coords | null, address: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${c ? `${c.lat},${c.lng}` : encodeURIComponent(address)}`;
