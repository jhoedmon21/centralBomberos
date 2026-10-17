// GET /api/traffic — tráfico en vivo + zonas problemáticas para el mapa.
//
// Fuente: Waze (Google) `live-map/api/georss`, sin API key. Si la red lo
// bloquea (403) o la zona no tiene datos, responde `source: "none"` —sin datos
// inventados— y la interfaz ofrece el visor embebido oficial de Waze
// (`embed.waze.com/es-419/iframe`). La respuesta se cachea 3 minutos.

import { connection } from "next/server";
import { jsonError } from "@/lib/errors";
import {
  ALERT_META,
  type TrafficAlert,
  type TrafficAlertKind,
  type TrafficFeed,
  type TrafficLevel,
  type TrafficSegment,
} from "@/lib/traffic";

const CACHE_MS = 3 * 60_000;
// Camaná y alrededores (la cobertura real de Waze en la zona es escasa)
const BBOX = { top: -16.56, bottom: -16.7, left: -72.78, right: -72.6 };

let cache: { at: number; feed: TrafficFeed } | null = null;

function classifyAlert(type: string, subtype: string): TrafficAlertKind | null {
  const s = `${type} ${subtype}`.toUpperCase();
  if (s.includes("ACCIDENT")) return "accidente";
  if (s.includes("ROAD_CLOSED")) return "cierre";
  if (s.includes("CONSTRUCTION")) return "construccion";
  if (s.includes("WEATHER")) return "clima";
  if (s.includes("HAZARD")) return "peligro";
  return null; // policía, chat, etc. — no son zonas problemáticas viales
}

function jamLevel(speedKmh: number | undefined): TrafficLevel {
  if (speedKmh === undefined) return "moderado";
  if (speedKmh < 12) return "congestionado";
  if (speedKmh < 28) return "moderado";
  return "fluido";
}

interface WazePoint {
  x: number;
  y: number;
}

async function fetchWazeFeed(): Promise<TrafficFeed | null> {
  try {
    const url =
      `https://www.waze.com/live-map/api/georss?top=${BBOX.top}&bottom=${BBOX.bottom}` +
      `&left=${BBOX.left}&right=${BBOX.right}&env=row&types=alerts,traffic`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
        Referer: "https://www.waze.com/live-map/",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "es-PE,es;q=0.9",
      },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      jams?: Array<{ uuid?: string; speedKMH?: number; line?: WazePoint[] }>;
      alerts?: Array<{
        uuid?: string;
        type?: string;
        subtype?: string;
        street?: string;
        pubMillis?: number;
        location?: WazePoint;
      }>;
    };

    const segments: TrafficSegment[] = (data.jams ?? [])
      .filter((j) => (j.line?.length ?? 0) >= 2)
      .map((j) => ({
        level: jamLevel(j.speedKMH),
        points: (j.line ?? []).map((p) => [p.y, p.x] as [number, number]),
      }));

    const alerts: TrafficAlert[] = [];
    for (const a of data.alerts ?? []) {
      const kind = classifyAlert(a.type ?? "", a.subtype ?? "");
      if (!kind || !a.location) continue;
      alerts.push({
        id: a.uuid ?? `${a.location.x},${a.location.y}`,
        kind,
        label: ALERT_META[kind].label,
        street: a.street ?? null,
        lat: a.location.y,
        lng: a.location.x,
        at: a.pubMillis ?? Date.now(),
      });
    }

    // Sin datos en la zona → sin capa (la interfaz ofrece el visor de Waze)
    if (!segments.length && !alerts.length) return null;

    return { source: "waze", fetchedAt: new Date().toISOString(), segments, alerts };
  } catch {
    return null;
  }
}

export async function GET() {
  await connection();
  try {
    if (cache && Date.now() - cache.at < CACHE_MS) {
      return Response.json(cache.feed);
    }
    const live = await fetchWazeFeed();
    const feed: TrafficFeed =
      live ?? { source: "none", fetchedAt: new Date().toISOString(), segments: [], alerts: [] };
    cache = { at: Date.now(), feed };
    return Response.json(feed);
  } catch (e) {
    return jsonError(e);
  }
}
