// DELETE /api/units/me/crew/[id] — el chofer da de baja a un bombero
// (se conserva el registro con leftAt para la bitácora).

import { broadcast } from "@/lib/bus";
import { prisma } from "@/lib/db";
import { ApiError, jsonError } from "@/lib/errors";
import { requireUnit } from "@/lib/unitapp";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUnit(request);
    const { id } = await params;
    const crewId = Number(id);
    if (!Number.isInteger(crewId)) throw new ApiError(400, "Id no válido");
    const row = await prisma.unitCrew.findFirst({
      where: { id: crewId, unitId: auth.unitId, leftAt: null },
      select: { id: true },
    });
    if (!row) throw new ApiError(404, "Ese bombero ya no está a bordo");
    await prisma.unitCrew.update({ where: { id: crewId }, data: { leftAt: new Date(), status: "fuera" } });
    broadcast({ type: "unit", action: "updated", id: auth.unitId });
    return Response.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
