// GET  /api/units/[id]/items — materiales/inventario de una unidad
// POST /api/units/[id]/items — agregar un material al inventario

import { connection } from "next/server";
import { jsonError } from "@/lib/errors";
import { createUnitItem, listUnitItems } from "@/lib/queries";

export async function GET(_request: Request, ctx: RouteContext<"/api/units/[id]/items">) {
  await connection();
  try {
    const { id } = await ctx.params;
    return Response.json({ items: await listUnitItems(Number(id)) });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(request: Request, ctx: RouteContext<"/api/units/[id]/items">) {
  try {
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const item = await createUnitItem(Number(id), {
      name: body.name,
      category: body.category,
      quantity: body.quantity,
      condition: body.condition,
      notes: body.notes,
    });
    return Response.json({ item }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
