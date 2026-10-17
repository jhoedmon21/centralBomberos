// Capa de tráfico para el mapa táctico.
//
// Fuente en vivo: Waze (Google) — `live-map/api/georss`, sin API key.
// Muchas redes reciben 403 (bloqueo anti-scraping de Waze): en ese caso la
// API responde `source: "none"` —sin datos inventados— y la interfaz ofrece el
// visor oficial embebido (`embed.waze.com/es-419/iframe`, sin key) con la
// congestión y las alertas viales en tiempo real del mapa colaborativo.

export type TrafficLevel = "fluido" | "moderado" | "congestionado";

export interface TrafficSegment {
  level: TrafficLevel;
  points: [number, number][]; // [lat, lng]
}

export const TRAFFIC_COLORS: Record<TrafficLevel, string> = {
  fluido: "#45c573",
  moderado: "#eea72c",
  congestionado: "#e8402f",
};

export const TRAFFIC_LABEL: Record<TrafficLevel, string> = {
  fluido: "Fluido",
  moderado: "Moderado",
  congestionado: "Congestionado",
};

// ------------------------------------------------------------------
// Tráfico en vivo + zonas problemáticas (alertas)
// ------------------------------------------------------------------

export type TrafficSource = "waze" | "none";

export type TrafficAlertKind = "accidente" | "cierre" | "construccion" | "peligro" | "clima";

export interface TrafficAlert {
  id: string;
  kind: TrafficAlertKind;
  label: string;
  street: string | null;
  lat: number;
  lng: number;
  at: number; // epoch ms
}

export interface TrafficFeed {
  source: TrafficSource;
  fetchedAt: string;
  segments: TrafficSegment[];
  alerts: TrafficAlert[];
}

export const ALERT_META: Record<TrafficAlertKind, { symbol: string; color: string; label: string }> = {
  accidente: { symbol: "✕", color: "var(--red)", label: "Accidente" },
  cierre: { symbol: "⊘", color: "var(--red)", label: "Vía cerrada" },
  construccion: { symbol: "▲", color: "var(--amber)", label: "Obras en la vía" },
  peligro: { symbol: "!", color: "var(--amber)", label: "Peligro en la vía" },
  clima: { symbol: "☁", color: "var(--blue)", label: "Clima adverso" },
};
