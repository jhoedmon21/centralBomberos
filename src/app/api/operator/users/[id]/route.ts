// PATCH  /api/operator/users/[id] — rol, activo o clave (solo jefe)
// DELETE /api/operator/users/[id] — dar de baja un operador (solo jefe, no a sí mismo)

import { ApiError, jsonError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { operatorActor, requireOperator } from "@/lib/opauth";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/passwords";
import { operatorUserPatchSchema } from "@/lib/schemas";

export async function PATCH(request: Request, ctx: RouteContext<"/api/operator/users/[id]">) {
  try {
    const op = await requireOperator(request, ["jefe"]);
    const { id } = await ctx.params;
    const targetId = Number(id);
    if (targetId === op.id) throw new ApiError(400, "No puedes editarte desde aquí — usa tu cuenta");

    const body = await request.json().catch(() => ({}));
    const parsed = operatorUserPatchSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Datos no válidos");

    const target = await prisma.operatorUser.findUnique({ where: { id: targetId }, select: { id: true, name: true } });
    if (!target) throw new ApiError(404, "Operador no encontrado");

    // Regla: si el cambio deja al último jefe activo sin su rol, se bloquea
    if (parsed.data.role || parsed.data.active === false) {
      const jefes = await prisma.operatorUser.count({ where: { role: "jefe", active: true } });
      const targetIsJefe = await prisma.operatorUser.findUnique({
        where: { id: targetId },
        select: { role: true },
      });
      if (
        targetIsJefe?.role === "jefe" &&
        (parsed.data.role && parsed.data.role !== "jefe") &&
        jefes <= 1
      ) {
        throw new ApiError(400, "No puede quedar el CAD sin ningún jefe activo");
      }
    }

    const user = await prisma.operatorUser.update({
      where: { id: targetId },
      data: {
        role: parsed.data.role,
        active: parsed.data.active,
        ...(parsed.data.password ? { passwordHash: hashPassword(parsed.data.password) } : {}),
      },
      select: { id: true, email: true, name: true, role: true, active: true },
    });
    logAudit(operatorActor(op), "user_patch", {
      userId: targetId,
      role: parsed.data.role,
      active: parsed.data.active,
      password: Boolean(parsed.data.password),
    });
    return Response.json({ user });
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/operator/users/[id]">) {
  try {
    const op = await requireOperator(request, ["jefe"]);
    const { id } = await ctx.params;
    const targetId = Number(id);
    if (targetId === op.id) throw new ApiError(400, "No puedes darte de baja a ti mismo");

    const target = await prisma.operatorUser.findUnique({ where: { id: targetId }, select: { role: true } });
    if (!target) throw new ApiError(404, "Operador no encontrado");
    if (target.role === "jefe") {
      const activeJefes = await prisma.operatorUser.count({ where: { role: "jefe", active: true } });
      if (activeJefes <= 1) throw new ApiError(400, "No puede quedar el CAD sin ningún jefe activo");
    }

    await prisma.operatorUser.delete({ where: { id: targetId } });
    logAudit(operatorActor(op), "user_delete", { userId: targetId });
    return Response.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
