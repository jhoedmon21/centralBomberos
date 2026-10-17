// PATCH /api/units/me/equipment/:id — marcar un material del checklist
// diario como revisado. Idempotente con opId (la marca es única por día).

import { connection } from "next/server";
import { ApiError, jsonError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { runIdempotent } from "@/lib/idem";
import { requireUnit } from "@/lib/unitapp";
import { equipmentCheckSchema } from "@/lib/schemas";

export async function PATCH(request: Request, ctx: RouteContext<"/api/units/me/equipment/[id]">) {
  await connection();
  try {
    const auth = await requireUnit(request);
    const { id } = await ctx.params;
    const itemId = Number(id);
    const body = await request.json().catch(() => ({}));
    const parsed = equipmentCheckSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Datos no válidos");
    }
    const { day, opId } = parsed.data;

    // La unidad solo puede revisar SU propio equipo
    const item = await prisma.unitItem.findUnique({ where: { id: itemId } });
    if (!item || item.unitId !== auth.unitId) throw new ApiError(404, "Material no encontrado en esta unidad");

    const result = await runIdempotent(`unit:${auth.unitId}`, opId ?? null, "equipment_check", async () => {
      const check = await prisma.equipmentCheck.upsert({
        where: { unitId_itemId_day: { unitId: auth.unitId, itemId, day } },
        update: { checkedAt: new Date() },
        create: { unitId: auth.unitId, itemId, day },
      });
      return { check: { id: check.id, itemId, day, checkedAt: check.checkedAt.toISOString() } };
    });

    return Response.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
