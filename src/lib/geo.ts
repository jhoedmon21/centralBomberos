// Geometría: distancias y selección de recursos cercanos

import type { HydrantDTO, PreplanDTO } from "./types";

const R_TIERRA_M = 6_371_000;

/** Distancia Haversine entre dos puntos (metros) */
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TIERRA_M * Math.asin(Math.sqrt(a));
}

export interface HydrantNear {
  hydrant: HydrantDTO;
  meters: number;
}

/** El preplan ACTIVO más cercano a un punto, solo si queda dentro de `meters` (null si no) */
export function nearestPreplan(
  lat: number,
  lng: number,
  preplans: PreplanDTO[],
  meters: number,
): PreplanDTO | null {
  let best: PreplanDTO | null = null;
  let bestM = Infinity;
  for (const p of preplans) {
    if (p.status !== "activo") continue;
    const m = haversineM(lat, lng, p.lat, p.lng);
    if (m < bestM) {
      bestM = m;
      best = p;
    }
  }
  return bestM <= meters ? best : null;
}

/** Los N hidrantes más cercanos a un punto, ordenados por distancia */
export function nearestHydrants(
  lat: number,
  lng: number,
  hydrants: HydrantDTO[],
  n = 3,
): HydrantNear[] {
  return hydrants
    .map((hydrant) => ({ hydrant, meters: haversineM(lat, lng, hydrant.lat, hydrant.lng) }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, n);
}

/** Centro de Camaná (Arequipa) por defecto para nuevos reportes */
export const CITY_CENTER = { lat: -16.6236, lng: -72.7106 };

/** Cuartel de la Compañía B-35 Camaná — Jr. N. de Piérola 308 (esq. Av. 9 de
 * Noviembre). Confirmado con el CGBVP y OSM (~3 m de diferencia). Origen por
 * defecto de las rutas y punto de salida de los despachos. */
export const FIREHOUSE = { lat: -16.62498, lng: -72.71212 };

/**
 * Estilos vectoriales OpenFreeMap para el mapa (sin API key, sin límites;
 * atribución OpenStreetMap/OpenFreeMap). Se pasan a los componentes mapcn.
 */
export const OFM_STYLES = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
} as const;

/** Anillo de coordenadas [lng, lat] que aproxima un círculo de `meters` de radio (proyección equirectangular). */
export function circleRing(lat: number, lng: number, meters: number, steps = 72): [number, number][] {
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.cos((lat * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return ring;
}
