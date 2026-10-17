// POST /api/units/[id]/logout — cierre de sesión remoto desde la central.
// Incrementa sessionEpoch de la unidad: todos los JWT emitidos para esta
// tablet dejan de ser válidos en el próximo request (si la roban o pierden,
// la app queda bloqueada). Se avisa por push y por SSE.

import { connection } from "next/server";
import { ApiError, jsonError } from "@/lib/errors";
import { broadcast } from "@/lib/bus";
import { prisma } from "@/lib/db";
import { sendPushToUnit } from "@/lib/push";

export async function POST(_request: Request, ctx: RouteContext<"/api/units/[id]/logout">) {
  await connection();
  try {
    const { id } = await ctx.params;
    const unitId = Number(id);
    const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { code: true } });
    if (!unit) throw new ApiError(404, "Unidad no encontrada");

    await prisma.unit.update({
      where: { id: unitId },
      data: { sessionEpoch: { increment: 1 } },
    });

    await sendPushToUnit(unitId, {
      kind: "status_forced",
      title: "Sesión cerrada",
      body: "La central cerró la sesión de esta tablet.",
    });
    broadcast({ type: "unit_logout", id: unitId, unitId });
    return Response.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
