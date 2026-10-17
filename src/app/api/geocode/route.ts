// GET /api/geocode?q=... — búsqueda de direcciones (Nominatim/OSM, sin API key).
//
// Se usa en el registro manual de reportes para fijar la ubicación a partir
// de la dirección escrita. Sesga los resultados hacia la provincia de Camaná
// (sin `bounded`, para no descartar direcciones vecinas) y cachea 1 hora en
// memoria, en línea con la política de uso de Nominatim.

import { connection } from "next/server";
import { jsonError } from "@/lib/errors";

const CACHE_MS = 60 * 60_000;
const MAX_CACHE = 120;
// Provincia de Camaná: izquierda, arriba, derecha, abajo
const VIEWBOX = { left: -72.95, top: -16.4, right: -72.45, bottom: -16.85 };

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
}

const cache = new Map<string, { at: number; results: GeocodeResult[] }>();

export async function GET(request: Request) {
  await connection();
  try {
    const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
    if (q.length < 3) return Response.json({ results: [] });

    const key = q.toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_MS) {
      return Response.json({ results: hit.results });
    }

    const url =
      "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=0&countrycodes=pe" +
      `&accept-language=es&q=${encodeURIComponent(q)}` +
      `&viewbox=${VIEWBOX.left},${VIEWBOX.top},${VIEWBOX.right},${VIEWBOX.bottom}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "FuegoMap-Central/1.0 (central de mando bomberil; demo local)",
        Accept: "application/json",
        "Accept-Language": "es-PE,es;q=0.9",
      },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return jsonError(new Error(`Nominatim respondió ${res.status}`));

    const data = (await res.json()) as Array<{ display_name?: string; lat?: string; lon?: string }>;
    const results: GeocodeResult[] = data
      .filter((r) => r.display_name && r.lat && r.lon)
      .map((r) => ({ label: r.display_name as string, lat: Number(r.lat), lng: Number(r.lon) }));

    if (cache.size >= MAX_CACHE) cache.clear();
    cache.set(key, { at: Date.now(), results });
    return Response.json({ results });
  } catch (e) {
    return jsonError(e);
  }
}
