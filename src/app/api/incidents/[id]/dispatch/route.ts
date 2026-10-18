// POST /api/incidents/[id]/dispatch — asignar y despachar UNA o VARIAS
// unidades (unitIds: number[]; también acepta unitId suelto por compat).
// Además de actualizar el incidente: envía Web Push a la tablet de cada
// unidad y, si una no acepta en 60 s, lo registra y avisa a la central.

import { ApiError, jsonError } from "@/lib/errors";
import { broadcast } from "@/lib/bus";
import { logAudit } from "@/lib/audit";
import { operatorActor, requireOperator } from "@/lib/opauth";
import { prisma } from "@/lib/db";
import { nearestPreplan } from "@/lib/geo";
import { listPreplans } from "@/lib/preplans";
import { sendPushToUnit } from "@/lib/push";
import { dispatchIncident } from "@/lib/queries";

const ACCEPT_TIMEOUT_MS = 60_000;

export async function POST(request: Request, ctx: RouteContext<"/api/incidents/[id]/dispatch">) {
  try {
    const op = await requireOperator(request, ["jefe", "operador"]);
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    // unitIds: array; unitId (solo) queda soportado por compatibilidad
    const raw = Array.isArray(body?.unitIds) ? body.unitIds : body?.unitId != null ? [body.unitId] : [];
    const unitIds = raw.map((n: unknown) => Number(n)).filter((n: number) => Number.isInteger(n) && n > 0);
    if (!unitIds.length) throw new ApiError(400, "Selecciona al menos una unidad válida");
    const incidentId = Number(id);
    // Refuerzos: el aviso de «no aceptó en 60 s» solo aplica a las unidades
    // NUEVAS de este despacho (las ya en misión ya tuvieron su aviso).
    const prevIds = new Set(
      (
        await prisma.incidentUnit.findMany({
          where: { incidentId },
          select: { unitId: true },
        })
      ).map((a) => a.unitId),
    );
    const freshIds = unitIds.filter((n: number) => !prevIds.has(n));
    const incident = await dispatchIncident(incidentId, unitIds);
    logAudit(operatorActor(op), "dispatch", { incidentId, units: unitIds });

    // ¿La escena cae sobre un edificio con ficha precargada? Se lo decimos a
    // la unidad en el propio aviso (la ficha llega dentro de la misión).
    let bodyNote = `${incident.title} — ${incident.address}`;
    try {
      const preplans = await listPreplans();
      if (nearestPreplan(incident.lat, incident.lng, preplans, 300)) {
        bodyNote += "  📋 Con ficha de edificio (ver misión)";
      }
    } catch {
      /* el aviso sale igual sin la nota */
    }

    for (const unitId of freshIds) {
      // Notificar a la tablet (Web Push de prioridad alta; la app en primer
      // plano también lo recibe por SSE y lanza la alerta con sonido/vibración)
      void sendPushToUnit(unitId, {
        kind: "dispatch",
        title: "🚨 Nuevo despacho",
        body: bodyNote,
        incidentId: incident.id,
        at: Date.now(),
      });

      // ¿Esa unidad no aceptó en 60 s? Avisar a la central (por unidad)
      const timer = setTimeout(async () => {
        try {
          const row = await prisma.incidentUnit.findUnique({
            where: { incidentId_unitId: { incidentId: incident.id, unitId } },
            select: { acceptedAt: true },
          });
          const accepted = row?.acceptedAt;
          if (!accepted && ["despachado", "en_escena"].includes(incident.status)) {
            await prisma.incidentEvent.create({
              data: {
                incidentId: incident.id,
                type: "nota",
                message: `La unidad no confirmó el despacho en 60 s`,
                actor: "sistema",
              },
            });
            broadcast({ type: "mission_unaccepted", id: incident.id, unitId });
            broadcast({ type: "activity" });
          }
        } catch {
          /* proceso reiniciado: el timeout se pierde (documentado) */
        }
      }, ACCEPT_TIMEOUT_MS);
      timer.unref?.();
    }

    return Response.json({ incident });
  } catch (e) {
    return jsonError(e);
  }
}
