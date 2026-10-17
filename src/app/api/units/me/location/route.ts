// POST /api/units/me/location — posición GPS de la unidad.
// La app la llama cada 5 s en misión / 30 s en reposo. Idempotente por
// sobrescritura (reintentar el mismo punto no duplica datos).
// El broadcast hacia la central se limita a 1 cada 8 s por unidad.

import { ApiError, jsonError } from "@/lib/errors";
import { broadcast } from "@/lib/bus";
import { prisma } from "@/lib/db";
import { requireUnit } from "@/lib/unitapp";
import { locationSchema } from "@/lib/schemas";

const THROTTLE_MS = 8_000;
const globalThrottle = globalThis as unknown as { __fmLoc?: Map<number, number> };
const lastBroadcast = globalThrottle.__fmLoc ?? (globalThrottle.__fmLoc = new Map());

export async function POST(request: Request) {
  try {
    const auth = await requireUnit(request);
    const body = await request.json().catch(() => ({}));
    const parsed = locationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Ubicación no válida");
    }
    const { lat, lng } = parsed.data;

    await prisma.unit.update({
      where: { id: auth.unitId },
      data: { lat, lng },
    });

    const now = Date.now();
    const last = lastBroadcast.get(auth.unitId) ?? 0;
    if (now - last >= THROTTLE_MS) {
      lastBroadcast.set(auth.unitId, now);
      broadcast({ type: "unit", action: "updated", id: auth.unitId });
    }

    return Response.json({ ok: true, at: now });
  } catch (e) {
    return jsonError(e);
  }
}
