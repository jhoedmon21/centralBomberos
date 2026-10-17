// PATCH /api/units/me/status — la unidad cambia su propio estado.
// Regla de conflicto: si la central cambió el estado DESPUÉS del toque
// del conductor (statusAt > clientAt), gana la central → 409 con el estado fresco.

import { connection } from "next/server";
import { ApiError, jsonError } from "@/lib/errors";
import { broadcast } from "@/lib/bus";
import { prisma } from "@/lib/db";
import { runIdempotent } from "@/lib/idem";
import { requireUnit, activeMission, unitDTO } from "@/lib/unitapp";
import { updateIncident } from "@/lib/queries";
import { statusSchema } from "@/lib/schemas";

export async function PATCH(request: Request) {
  await connection();
  try {
    const auth = await requireUnit(request);
    const body = await request.json().catch(() => ({}));
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Datos no válidos");
    }
    const { status, opId, clientAt } = parsed.data;

    const result = await runIdempotent(`unit:${auth.unitId}`, opId ?? null, "status", async () => {
      const current = await prisma.unit.findUnique({ where: { id: auth.unitId } });
      if (!current) throw new ApiError(404, "Unidad no encontrada");

      // Conflicto: el cambio de la central es más reciente que el toque del conductor
      if (clientAt !== undefined && current.statusAt.getTime() > clientAt && current.status !== status) {
        throw new ApiError(409, "La central cambió tu estado hace un momento — revisa y vuelve a tocar");
      }

      const now = new Date();
      await prisma.unit.update({
        where: { id: auth.unitId },
        data: { status, statusAt: now, statusSource: "unidad" },
      });

      // Si el conductor marca "En el lugar" con misión despachada → llegada al incidente
      const mission = await activeMission(auth.unitId);
      if (status === "en_escena" && mission && mission.status === "despachado") {
        await updateIncident(mission.id, { status: "en_escena" }, "unidad");
      }

      broadcast({ type: "unit", action: "updated", id: auth.unitId });
      broadcast({ type: "activity" });
      return { unit: await unitDTO(auth.unitId) };
    });

    return Response.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
