// PATCH  /api/units/[id] — cambiar estado, dotación o ubicación de una unidad
// DELETE /api/units/[id] — dar de baja una unidad (y su inventario) — solo jefe

import { jsonError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { operatorActor, requireOperator } from "@/lib/opauth";
import { deleteUnit, updateUnit } from "@/lib/queries";
import type { UnitStatus } from "@/lib/types";

export async function PATCH(request: Request, ctx: RouteContext<"/api/units/[id]">) {
  try {
    const op = await requireOperator(request, ["jefe", "operador"]);
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const unit = await updateUnit(Number(id), {
      status: body.status as UnitStatus | undefined,
      crew: body.crew,
      lat: body.lat,
      lng: body.lng,
      statusSource: "operador",
    });
    logAudit(operatorActor(op), "unit_patch", {
      unitId: unit.id,
      code: unit.code,
      status: body.status,
      crew: body.crew,
    });
    return Response.json({ unit });
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/units/[id]">) {
  try {
    const op = await requireOperator(request, ["jefe"]);
    const { id } = await ctx.params;
    await deleteUnit(Number(id));
    logAudit(operatorActor(op), "unit_delete", { unitId: Number(id) });
    return Response.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
