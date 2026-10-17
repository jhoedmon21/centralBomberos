// Capa de sismos (terremotos) para el mapa táctico.
//
// Fuente: USGS `summary/2.5_week.geojson` (magnitud ≥ 2.5, últimos 7 días),
// sin API key. Se filtra a un radio alrededor de Camaná: sismos que pueden
// sentirse en la zona o ameritar revisión de estructuras.

export interface QuakeDTO {
  id: string;
  mag: number;
  place: string;
  lat: number;
  lng: number;
  depthKm: number;
  at: number; // epoch ms
}

export interface QuakesFeed {
  source: "usgs" | "none";
  fetchedAt: string;
  /** Radio de filtrado alrededor de Camaná (km) */
  radiusKm: number;
  quakes: QuakeDTO[];
}

/** Radio de la capa: sismos dentro de este radio de Camaná (km). */
export const QUAKES_RADIUS_KM = 700;

export const EMPTY_QUAKES: QuakesFeed = {
  source: "none",
  fetchedAt: "",
  radiusKm: QUAKES_RADIUS_KM,
  quakes: [],
};

/** Color por magnitud (ámbar → naranja → rojo). Hex: los trazos se pintan en SVG. */
export function quakeColor(mag: number): string {
  if (mag >= 5) return "#e8402f";
  if (mag >= 4) return "#ef6b2a";
  return "#eea72c";
}

/** Radio del círculo en píxeles según magnitud (M2.5 → 4 px … M7+ → 17 px) */
export function quakeRadius(mag: number): number {
  return Math.max(4, Math.min(17, 4 + (mag - 2.5) * 3));
}

const COMPASS: Record<string, string> = {
  N: "N",
  NNE: "NNE",
  NE: "NE",
  ENE: "ENE",
  E: "E",
  ESE: "ESE",
  SE: "SE",
  SSE: "SSE",
  S: "S",
  SSW: "SSO",
  SW: "SO",
  WSW: "OSO",
  W: "O",
  WNW: "ONO",
  NW: "NO",
  NNW: "NNO",
};

/** "45 km SSW of Atico, Peru" → "a 45 km SSO de Atico, Peru" (rumbo en español) */
export function placeEs(place: string): string {
  return place
    .replace(
      /\b(NNW|WNW|WSW|SSW|NNE|ENE|ESE|SSE|NE|NW|SW|SE|N|S|E|W)\b of\b/g,
      (_m, d: string) => `${COMPASS[d] ?? d} de`,
    )
    .replace(/^(\d)/, "a $1");
}
