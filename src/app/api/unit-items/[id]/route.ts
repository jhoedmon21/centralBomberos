// PATCH  /api/unit-items/[id] — editar un material del inventario
// DELETE /api/unit-items/[id] — quitar un material del inventario

import { jsonError } from "@/lib/errors";
import { deleteUnitItem, updateUnitItem } from "@/lib/queries";

export async function PATCH(request: Request, ctx: RouteContext<"/api/unit-items/[id]">) {
  try {
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const item = await updateUnitItem(Number(id), {
      name: body.name,
      category: body.category,
      quantity: body.quantity,
      condition: body.condition,
      notes: body.notes,
    });
    return Response.json({ item });
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/unit-items/[id]">) {
  try {
    const { id } = await ctx.params;
    await deleteUnitItem(Number(id));
    return Response.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
