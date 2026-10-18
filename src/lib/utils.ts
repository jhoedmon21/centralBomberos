// Utilidades generales (compartidas cliente/servidor)

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Alias estilo shadcn (une clases) para componentes externos como mapcn. */
export const cn = cx;

export function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

/** Código legible del incidente: FW-2026-0001 */
export function displayCode(id: number, createdAt: string): string {
  return `FW-${new Date(createdAt).getFullYear()}-${pad(id, 4)}`;
}

/** Tiempo relativo en español: "hace 3 min", "hace 2 h", "hace 4 d" */
export function timeAgo(iso: string, nowMs?: number): string {
  const now = nowMs ?? Date.now();
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function fmtCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** Solo dígitos para números de WhatsApp */
export function digitsOnly(s: string): string {
  return (s || "").replace(/\D/g, "");
}

/** Teléfono enmascarado para mostrar: +51 9•• ••• 321 */
export function maskPhone(s: string | null): string {
  if (!s) return "—";
  const d = digitsOnly(s);
  if (d.length < 6) return d;
  return `+${d.slice(0, 2)} ${d[2]}•• ••• ${d.slice(-3)}`;
}

/**
 * Nombre visible del hidrante: el código «H-01» se lee «Hidrante 01».
 * Otros formatos (p. ej. «OSM-123456») quedan tal cual; sin código → «Hidrante».
 */
export function hydrantLabel(code: string | null | undefined): string {
  if (!code) return "Hidrante";
  const m = /^H[-\s]?(\S+)$/i.exec(code.trim());
  return m ? `Hidrante ${m[1]}` : code;
}
