// GET /api/route?from=lat,lng&to=lat,lng — ruta vial entre dos puntos para el
// mapa de la central (botón «Ruta» del detalle).
//
// Fuente: OSRM público (router.project-osrm.org, sin API key; el mismo que usa
// la app de unidades vía OSRM_BASE_URL). Si no responde, devuelve la línea
// recta con `estimated: true` —sin inventar calle por calle—. Caché 10 min.

import { connection } from "next/server";
import { ApiError, jsonError } from "@/lib/errors";
import { haversineM } from "@/lib/geo";
import type { RouteDTO } from "@/lib/types";

const CACHE_MS = 10 * 60_000;
const MAX_CACHE = 120;
const OSRM = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";

const cache = new Map<string, { at: number; route: RouteDTO }>();

/** "lat,lng" → [lat, lng] con validación de rango */
function parsePoint(raw: string | null): [number, number] | null {
  if (!raw) return null;
  const m = /^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/.exec(raw.trim());
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

async function fetchRoute(from: [number, number], to: [number, number]): Promise<RouteDTO> {
  // Respaldo honesto: línea recta + ETA a 30 km/h urbanos
  const meters = haversineM(from[0], from[1], to[0], to[1]);
  const fallback: RouteDTO = {
    points: [
      [from[1], from[0]],
      [to[1], to[0]],
    ],
    meters,
    seconds: meters / (30_000 / 3600),
    estimated: true,
  };
  try {
    const url =
      `${OSRM}/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}` +
      `?overview=full&geometries=geojson&alternatives=false&steps=false`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "FuegoMap-Central/1.0 (central de mando bomberil; demo local)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as {
      code?: string;
      routes?: Array<{ distance?: number; duration?: number; geometry?: { coordinates?: [number, number][] } }>;
    };
    const r = data.routes?.[0];
    const coords = r?.geometry?.coordinates;
    if (data.code !== "Ok" || !r || !coords || coords.length < 2) return fallback;
    return {
      points: coords,
      meters: Math.round(r.distance ?? meters),
      seconds: Math.round(r.duration ?? fallback.seconds),
      estimated: false,
    };
  } catch {
    return fallback;
  }
}

export async function GET(request: Request) {
  await connection();
  try {
    const sp = new URL(request.url).searchParams;
    const from = parsePoint(sp.get("from"));
    const to = parsePoint(sp.get("to"));
    if (!from || !to) throw new ApiError(400, "Coordenadas inválidas (formato: from=lat,lng&to=lat,lng)");
    if (haversineM(from[0], from[1], to[0], to[1]) > 200_000) {
      throw new ApiError(400, "La ruta supera los 200 km permitidos");
    }

    const key = `${from[0].toFixed(5)},${from[1].toFixed(5)}>${to[0].toFixed(5)},${to[1].toFixed(5)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) {
      return Response.json({ route: hit.route });
    }

    const route = await fetchRoute(from, to);
    if (cache.size >= MAX_CACHE) cache.clear();
    cache.set(key, { at: Date.now(), route });
    return Response.json({ route });
  } catch (e) {
    return jsonError(e);
  }
}
