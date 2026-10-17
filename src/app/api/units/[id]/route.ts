// PATCH  /api/units/[id] — cambiar estado, dotación o ubicación de una unidad
// DELETE /api/units/[id] — dar de baja una unidad (y su inventario)

import { jsonError } from "@/lib/errors";
import { deleteUnit, updateUnit } from "@/lib/queries";
import type { UnitStatus } from "@/lib/types";

export async function PATCH(request: Request, ctx: RouteContext<"/api/units/[id]">) {
  try {
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const unit = await updateUnit(Number(id), {
      status: body.status as UnitStatus | undefined,
      crew: body.crew,
      lat: body.lat,
      lng: body.lng,
      statusSource: "operador",
    });
    return Response.json({ unit });
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/units/[id]">) {
  try {
    const { id } = await ctx.params;
    await deleteUnit(Number(id));
    return Response.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
