// POST /api/units/me/mission/accept — la unidad acepta el despacho
// Idempotente por naturaleza: si ya estaba aceptado, devuelve lo mismo.

import { connection } from "next/server";
import { ApiError, jsonError } from "@/lib/errors";
import { broadcast } from "@/lib/bus";
import { prisma } from "@/lib/db";
import { requireUnit, activeMission } from "@/lib/unitapp";
import { toIncidentDTO } from "@/lib/queries";

export async function POST(request: Request) {
  await connection();
  try {
    const auth = await requireUnit(request);
    const mission = await activeMission(auth.unitId);
    if (!mission) throw new ApiError(404, "No hay misión activa para esta unidad");

    // Aceptación POR UNIDAD: la fila IncidentUnit de esta unidad marca su
    // propia aceptación; incident.acceptedAt queda con la PRIMERA aceptación
    // (compat con listas de la central y el aviso de 60 s).
    const now = new Date();
    await prisma.incidentUnit.updateMany({
      where: { incidentId: mission.id, unitId: auth.unitId, acceptedAt: null },
      data: { acceptedAt: now },
    });
    if (!mission.acceptedAt) {
      await prisma.incident.update({
        where: { id: mission.id },
        data: {
          acceptedAt: now,
          events: {
            create: {
              type: "estado",
              message: "Despacho aceptado por la unidad (app FuegoMap Unidades)",
              actor: "unidad",
            },
          },
        },
      });
      broadcast({ type: "incident", action: "updated", id: mission.id });
      broadcast({ type: "activity" });
    } else {
      // Aceptación adicional de otra unidad: solo se ve en la bitácora / fila
      broadcast({ type: "activity" });
    }

    const fresh = await prisma.incident.findUnique({
      where: { id: mission.id },
      include: { unit: true, events: { orderBy: { createdAt: "asc" } } },
    });
    return Response.json({ incident: toIncidentDTO(fresh!) });
  } catch (e) {
    return jsonError(e);
  }
}
