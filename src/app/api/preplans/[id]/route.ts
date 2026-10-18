// PATCH  /api/preplans/[id] — editar ficha o estado (activo/inactivo) — jefe u operador
// DELETE /api/preplans/[id] — eliminar ficha — solo jefe

import { ApiError, jsonError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { operatorActor, requireOperator } from "@/lib/opauth";
import { deletePreplan, updatePreplan } from "@/lib/preplans";
import { preplanSchema } from "@/lib/schemas";

export async function PATCH(request: Request, ctx: RouteContext<"/api/preplans/[id]">) {
  try {
    const op = await requireOperator(request, ["jefe", "operador"]);
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const parsed = preplanSchema.partial().safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Ficha no válida");

    const preplan = await updatePreplan(Number(id), parsed.data);
    logAudit(operatorActor(op), "preplan_patch", {
      preplanId: preplan.id,
      fields: Object.keys(parsed.data),
    });
    return Response.json({ preplan });
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/preplans/[id]">) {
  try {
    const op = await requireOperator(request, ["jefe"]);
    const { id } = await ctx.params;
    await deletePreplan(Number(id));
    logAudit(operatorActor(op), "preplan_delete", { preplanId: Number(id) });
    return Response.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
