// GET   /api/operator/me — datos del operador conectado (chip de la cabecera)
// PATCH /api/operator/me — cambiar mi propia clave (verificando la actual)

import { ApiError, jsonError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { operatorActor, requireOperator } from "@/lib/opauth";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { operatorSelfPatchSchema } from "@/lib/schemas";

export async function GET(request: Request) {
  try {
    const op = await requireOperator(request);
    return Response.json({ operator: { id: op.id, name: op.name, email: op.email, role: op.role } });
  } catch (e) {
    return jsonError(e);
  }
}

export async function PATCH(request: Request) {
  try {
    const op = await requireOperator(request);
    const body = await request.json().catch(() => ({}));
    const parsed = operatorSelfPatchSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Datos no válidos");

    const row = await prisma.operatorUser.findUnique({ where: { id: op.id }, select: { passwordHash: true } });
    if (!row || !verifyPassword(parsed.data.current, row.passwordHash)) {
      throw new ApiError(401, "Tu clave actual no es correcta");
    }
    await prisma.operatorUser.update({
      where: { id: op.id },
      data: { passwordHash: hashPassword(parsed.data.password) },
    });
    logAudit(operatorActor(op), "self_password");
    return Response.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
