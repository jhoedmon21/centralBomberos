// POST /api/missions/:id/close — cierre de misión desde la app de la unidad.
// Guarda el reporte (resultado, heridos, observaciones, foto) y cierra el
// incidente. Idempotente con opId: reintentos sin señal no duplican.

import { connection } from "next/server";
import { ApiError, jsonError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { runIdempotent } from "@/lib/idem";
import { saveDataUrl } from "@/lib/media";
import { requireUnit } from "@/lib/unitapp";
import { updateIncident } from "@/lib/queries";
import { closeMissionSchema } from "@/lib/schemas";

const RESULT_MESSAGE: Record<string, string> = {
  controlado: "Emergencia controlada",
  sin_novedad: "Sin novedad al llegar",
  falsa_alarma: "Falsa alarma",
  derivado: "Atención derivada a otra unidad",
};

export async function POST(request: Request, ctx: RouteContext<"/api/missions/[id]/close">) {
  await connection();
  try {
    const auth = await requireUnit(request);
    const { id } = await ctx.params;
    const incidentId = Number(id);
    const body = await request.json().catch(() => ({}));
    const parsed = closeMissionSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Datos no válidos");
    }
    const { result, injured, observations, photoBase64, opId } = parsed.data;

    // Solo la unidad asignada puede cerrar SU misión
    const incident = await prisma.incident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new ApiError(404, "Misión no encontrada");
    if (incident.unitId !== auth.unitId) throw new ApiError(403, "Esta misión no corresponde a tu unidad");

    const resultJson = await runIdempotent(`unit:${auth.unitId}`, opId ?? null, "close_mission", async () => {
      const photoUrl = photoBase64 ? await saveDataUrl(photoBase64) : null;
      await prisma.missionReport.create({
        data: {
          incidentId,
          unitId: auth.unitId,
          result,
          injured,
          observations: observations || null,
          photoUrl,
        },
      });
      await prisma.incidentEvent.create({
        data: {
          incidentId,
          type: "nota",
          message: `Cierre desde la app: ${RESULT_MESSAGE[result]}${injured > 0 ? ` · ${injured} herido(s)` : ""}`,
          actor: "unidad",
        },
      });
      // El cierre de la unidad cierra el incidente (transición en_escena/controlado → cerrado)
      const closed = await updateIncident(incidentId, { status: "cerrado" }, "unidad");
      return { incident: closed };
    });

    return Response.json(resultJson);
  } catch (e) {
    return jsonError(e);
  }
}
