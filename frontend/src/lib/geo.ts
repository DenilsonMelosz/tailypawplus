import { STATE_NAMES } from "./cities";

const mem = new Map<string, [number, number] | null>();

/** Centro aproximado da cidade (OpenStreetMap/Nominatim), guardado no navegador. */
export async function cityCenter(city: string, uf: string): Promise<[number, number] | null> {
  if (!city || !uf) return null;
  const key = `${city}|${uf}`;
  if (mem.has(key)) return mem.get(key)!;
  try {
    const c = localStorage.getItem(`tp_geo_${key}`);
    if (c) { const v = JSON.parse(c) as [number, number]; mem.set(key, v); return v; }
  } catch { /* ok */ }
  try {
    const qs = new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "br", city, state: STATE_NAMES[uf] ?? uf, "accept-language": "pt-BR" });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`);
    if (!res.ok) throw new Error("geo");
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    const v: [number, number] | null = hit ? [Number(hit.lat), Number(hit.lon)] : null;
    mem.set(key, v);
    if (v) { try { localStorage.setItem(`tp_geo_${key}`, JSON.stringify(v)); } catch { /* ok */ } }
    return v;
  } catch {
    return null;
  }
}

export const BRASIL: [number, number] = [-14.235, -51.925];
