// GET /api/quakes — sismos recientes (USGS, sin API key) alrededor de Camaná.
//
// Fuente: USGS `summary/2.5_week.geojson` (M ≥ 2.5, últimos 7 días, cobertura
// global); aquí se filtra a un radio de 700 km de Camaná —sismos que pueden
// sentirse en la zona o ameritar revisión de estructuras—. Si USGS no responde,
// `source: "none"` —sin datos inventados—. La respuesta se cachea 10 minutos.

import { connection } from "next/server";
import { jsonError } from "@/lib/errors";
import { CITY_CENTER, haversineM } from "@/lib/geo";
import { QUAKES_RADIUS_KM, type QuakeDTO, type QuakesFeed } from "@/lib/quakes";

const CACHE_MS = 10 * 60_000;
const FEED_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson";

let cache: { at: number; feed: QuakesFeed } | null = null;

interface UsgsFeature {
  id?: string;
  properties?: { mag?: number | null; place?: string | null; time?: number | null };
  geometry?: { coordinates?: [number, number, number?] };
}

async function fetchQuakes(): Promise<QuakesFeed> {
  const none: QuakesFeed = {
    source: "none",
    fetchedAt: new Date().toISOString(),
    radiusKm: QUAKES_RADIUS_KM,
    quakes: [],
  };
  try {
    const res = await fetch(FEED_URL, {
      headers: {
        "User-Agent": "FuegoMap-Central/1.0 (central de mando bomberil; demo local)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return none;

    const data = (await res.json()) as { features?: UsgsFeature[] };
    const quakes: QuakeDTO[] = [];
    for (const f of data.features ?? []) {
      const coords = f.geometry?.coordinates;
      const mag = f.properties?.mag;
      const at = f.properties?.time;
      if (!coords || typeof mag !== "number" || typeof at !== "number") continue;
      const [lng, lat, depth = 0] = coords;
      if (haversineM(lat, lng, CITY_CENTER.lat, CITY_CENTER.lng) > QUAKES_RADIUS_KM * 1000) continue;
      quakes.push({
        id: f.id ?? `${lat},${lng},${at}`,
        mag,
        place: f.properties?.place ?? "Sismo",
        lat,
        lng,
        depthKm: depth,
        at,
      });
    }
    quakes.sort((a, b) => b.at - a.at);
    return { source: "usgs", fetchedAt: new Date().toISOString(), radiusKm: QUAKES_RADIUS_KM, quakes };
  } catch {
    return none;
  }
}

export async function GET() {
  await connection();
  try {
    if (cache && Date.now() - cache.at < CACHE_MS) {
      return Response.json(cache.feed);
    }
    const feed = await fetchQuakes();
    cache = { at: Date.now(), feed };
    return Response.json(feed);
  } catch (e) {
    return jsonError(e);
  }
}
