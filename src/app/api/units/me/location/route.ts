// POST /api/units/me/location — posición GPS de la unidad.
// La app la llama cada 5 s en misión / 30 s en reposo. Idempotente por
// sobrescritura (reintentar el mismo punto no duplica datos).
// El broadcast se limita a 1 cada UNIT_BROADCAST_MS por unidad (4 s por
// defecto) y VIAJA con la instantánea de la unidad: la central mueve el
// marcador al instante, sin refrescar todo el tablero.

import { ApiError, jsonError } from "@/lib/errors";
import { broadcast } from "@/lib/bus";
import { prisma } from "@/lib/db";
import { haversineM } from "@/lib/geo";
import { requireUnit } from "@/lib/unitapp";
import { locationSchema } from "@/lib/schemas";

const THROTTLE_MS = Number(process.env.UNIT_BROADCAST_MS ?? 4_000);
const globalThrottle = globalThis as unknown as { __fmLoc?: Map<number, number> };
const lastBroadcast = globalThrottle.__fmLoc ?? (globalThrottle.__fmLoc = new Map());

// Estados en los que la unidad «está de salida»: solo entonces el recorrido
// se graba en el historial (los pings en reposo no aportan al track).
const MISSION_STATUSES = ["en_ruta", "en_escena", "regresando"] as string[];

export async function POST(request: Request) {
  try {
    const auth = await requireUnit(request);
    const body = await request.json().catch(() => ({}));
    const parsed = locationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Ubicación no válida");
    }
    const { lat, lng } = parsed.data;

    const updated = await prisma.unit.update({
      where: { id: auth.unitId },
      data: { lat, lng },
      // Solo lo que consume la central: la instantánea se incluye en el SSE
      // (cero consultas extra por ping).
      select: { id: true, code: true, lat: true, lng: true, status: true },
    });

    // Historial GPS (GpsPoint): un punto por ping en misión, pero se descarta
    // si está a menos de 15 m del último (GPS parado con jitter no ensucia el
    // recorrido). Útil para «Ver recorrido» y reportes de tiempos de respuesta.
    if (MISSION_STATUSES.includes(updated.status)) {
      const last = await prisma.gpsPoint.findFirst({
        where: { unitId: auth.unitId },
        orderBy: { at: "desc" },
        select: { lat: true, lng: true },
      });
      if (!last || haversineM(last.lat, last.lng, lat, lng) >= 15) {
        await prisma.gpsPoint.create({ data: { unitId: auth.unitId, lat, lng } });
      }
    }

    const now = Date.now();
    const last = lastBroadcast.get(auth.unitId) ?? 0;
    if (now - last >= THROTTLE_MS) {
      lastBroadcast.set(auth.unitId, now);
      broadcast({ type: "unit", action: "updated", id: auth.unitId, unit: updated });
    }

    return Response.json({ ok: true, at: now });
  } catch (e) {
    return jsonError(e);
  }
}
