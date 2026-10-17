// Plantillas de mensajes de WhatsApp y enlaces wa.me

import type { HydrantNear } from "./geo";
import type { IncidentDTO } from "./types";
import { digitsOnly, fmtCoords, fmtDistance } from "./utils";

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${digitsOnly(phone)}?text=${encodeURIComponent(text)}`;
}

export function mapsPoint(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function mapsRoute(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function mapEmbed(lat: number, lng: number): string {
  const d = 0.004;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

/**
 * Mapa estático sin API key (Yandex) con la escena (rojo) y los hidrantes
 * cercanos (azul) — se comparte en el despacho y se previsualiza en el diálogo.
 */
export function staticOpsMapUrl(
  incident: Pick<IncidentDTO, "lat" | "lng">,
  hydrants: HydrantNear[],
): string {
  const pt = [
    `${incident.lng},${incident.lat},pm2rdl`,
    ...hydrants.map((h) => `${h.hydrant.lng},${h.hydrant.lat},pm2blm`),
  ].join("~");
  return `https://static-maps.yandex.ru/1.x/?lang=en_US&ll=${incident.lng},${incident.lat}&z=15&size=650,450&l=map&pt=${pt}`;
}

const SEV_LABEL: Record<string, string> = {
  critica: "CRÍTICA 🔴",
  alta: "ALTA 🟠",
  media: "MEDIA 🟡",
  baja: "BAJA 🔵",
};

/** Mensaje de despacho que recibe la unidad por WhatsApp */
export function dispatchMessage(
  incident: IncidentDTO,
  code: string,
  hydrants: HydrantNear[],
): string {
  const lines = [
    "🚒 *DESPACHO UNIDAD FUEGOMAP*",
    "¡MISIÓN ASIGNADA!",
    "",
    `📍 Emergencia: ${incident.title}`,
    `🆔 Código: ${code}`,
    `⚠️ Severidad: ${SEV_LABEL[incident.severity] ?? incident.severity}`,
    `📌 Dirección: ${incident.address}`,
    `🧭 Coordenadas: ${fmtCoords(incident.lat, incident.lng)}`,
    `📍 Ubicación (pin): ${mapsPoint(incident.lat, incident.lng)}`,
    `🚗 Ruta táctica: ${mapsRoute(incident.lat, incident.lng)}`,
  ];
  if (incident.photoUrl) {
    lines.push(`📷 Foto del reporte: ${absoluteMediaUrl(incident.photoUrl)}`);
  }
  if (hydrants.length) {
    lines.push("", "💧 *Hidrantes cercanos a la escena:*");
    hydrants.forEach((h, i) => {
      lines.push(
        `${i + 1}. ${h.hydrant.code ?? "Hidrante"} — ${fmtDistance(h.meters)} (${h.hydrant.pressure ?? "s/d"})`,
      );
    });
  }
  lines.push(
    "",
    `🗺️ *Mapa de la escena e hidrantes:* ${staticOpsMapUrl(incident, hydrants)}`,
  );
  if (incident.notes) lines.push("", `📝 Nota: ${incident.notes}`);
  lines.push("", "Confirme recepción del despacho. Central FuegoMap.");
  return lines.join("\n");
}

/** Base pública (Ajustes) para los enlaces compartidos por WhatsApp; vacío = usar el origen actual */
let publicBase = "";

export function setPublicBase(url: string): void {
  publicBase = url.trim().replace(/\/+$/, "");
}

/** Convierte /api/media/... o /evidencia-incendio.jpg en una URL absoluta para compartir */
function absoluteMediaUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (publicBase) return `${publicBase}${url}`;
  return typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
}

/** Respuesta al ciudadano que reportó */
export function replyMessage(incident: IncidentDTO, code: string): string {
  return [
    `Central FuegoMap 🚒: recibimos su reporte de "${incident.title}" (${code}).`,
    "Una unidad va en camino. Manténgase a salvo, aléjese del humo y comparta su ubicación en tiempo real.",
    `Referencia: ${incident.address}`,
  ].join("\n");
}

/** Aviso de recepción para la central */
export function incomingMessage(incident: IncidentDTO, code: string): string {
  return [
    "🔥 *NUEVO REPORTE CIUDADANO*",
    `🆔 ${code}`,
    `📍 ${incident.title} — ${incident.address}`,
    `🧭 ${fmtCoords(incident.lat, incident.lng)}`,
    `🗺️ ${mapsPoint(incident.lat, incident.lng)}`,
  ].join("\n");
}
