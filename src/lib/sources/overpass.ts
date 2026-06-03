// OpenStreetMap local-business discovery — Nominatim (city → bounding box) then
// Overpass (businesses by category). Keyless and free. Polite: descriptive
// User-Agent, serial calls, permanent in-process bbox cache. OSM data is ODbL.
import { config } from "../config";
import type { DiscoveredLead } from "./types";

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
}

// Friendly category → OSM tag filter.
const CATEGORY_PRESETS: Record<string, string> = {
  cafe: "amenity=cafe",
  coffee: "amenity=cafe",
  restaurant: "amenity=restaurant",
  bakery: "shop=bakery",
  gym: "leisure=fitness_centre",
  salon: "shop=hairdresser",
  beauty: "shop=beauty",
  retail: "shop",
  clothing: "shop=clothes",
  boutique: "shop=clothes",
  dentist: "amenity=dentist",
  hotel: "tourism=hotel",
};

/** Resolve a friendly category or a raw "key=value" into an OSM tag filter. */
export function resolveCategory(input: string): { key: string; value?: string } {
  const spec = CATEGORY_PRESETS[input.toLowerCase().trim()] ?? input.trim();
  const [key, value] = spec.split("=");
  return { key, value: value || undefined };
}

/** Pure mapping of Overpass elements → DiscoveredLead[] (only named features). */
export function mapOverpassElements(elements: OverpassElement[]): DiscoveredLead[] {
  const out: DiscoveredLead[] = [];
  for (const el of elements) {
    const t = el.tags ?? {};
    const name = t.name;
    if (!name) continue;
    const website = t.website || t["contact:website"] || null;
    const email = t.email || t["contact:email"] || null;
    const phone = t.phone || t["contact:phone"] || null;
    const city = t["addr:city"] || null;
    const industry = t.amenity || t.shop || t.leisure || t.tourism || null;
    out.push({
      businessName: name,
      website,
      email,
      whatsapp: phone, // a listed phone is a usable manual-outreach channel
      location: city,
      industry,
      sourceType: "OVERPASS",
      sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      painPoint: website ? null : "No website listed (possible web-build opportunity).",
      rawText: [name, industry].filter(Boolean).join(" "),
    });
  }
  return out;
}

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS = "https://overpass-api.de/api/interpreter";

// Permanent (process-lifetime) cache — city → Overpass bbox [south, west, north, east].
const bboxCache = new Map<string, [number, number, number, number] | null>();

export async function geocodeCity(
  city: string,
): Promise<[number, number, number, number] | null> {
  const key = city.toLowerCase().trim();
  if (bboxCache.has(key)) return bboxCache.get(key) ?? null;

  const qs = new URLSearchParams({ q: city, format: "json", limit: "1" });
  try {
    const res = await fetch(`${NOMINATIM}?${qs.toString()}`, {
      headers: { "User-Agent": config.USER_AGENT, "Accept-Language": "en" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      bboxCache.set(key, null);
      return null;
    }
    const arr = (await res.json()) as Array<{ boundingbox?: string[] }>;
    const bb = arr[0]?.boundingbox; // Nominatim order: [south, north, west, east]
    if (!bb || bb.length < 4) {
      bboxCache.set(key, null);
      return null;
    }
    // Reorder to Overpass order: [south, west, north, east].
    const out: [number, number, number, number] = [+bb[0], +bb[2], +bb[1], +bb[3]];
    bboxCache.set(key, out);
    return out;
  } catch {
    bboxCache.set(key, null);
    return null;
  }
}

export async function discoverBusinesses(input: {
  city: string;
  category: string;
  limit?: number;
}): Promise<{ leads: DiscoveredLead[]; note?: string }> {
  const bbox = await geocodeCity(input.city);
  if (!bbox) return { leads: [], note: `Could not geocode city: ${input.city}` };

  const { key, value } = resolveCategory(input.category);
  const filter = value ? `["${key}"="${value}"]` : `["${key}"]`;
  const [s, w, n, e] = bbox;
  const lim = Math.min(input.limit ?? 25, 60);
  const ql =
    `[out:json][timeout:25];` +
    `(node${filter}(${s},${w},${n},${e});way${filter}(${s},${w},${n},${e}););` +
    `out center ${lim};`;

  try {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: {
        "User-Agent": config.USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ data: ql }).toString(),
      signal: AbortSignal.timeout(40000),
    });
    if (!res.ok) return { leads: [], note: `Overpass error ${res.status}` };
    const json = (await res.json()) as { elements?: OverpassElement[] };
    const leads = mapOverpassElements(json.elements ?? []).slice(0, input.limit ?? 25);
    return { leads };
  } catch (err) {
    return {
      leads: [],
      note: `Overpass fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
