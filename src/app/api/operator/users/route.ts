// GET  /api/operator/users — lista de operadores del CAD (solo jefe)
// POST /api/operator/users — alta de un operador (solo jefe)

import { ApiError, jsonError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { operatorActor, requireOperator } from "@/lib/opauth";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/passwords";
import { operatorUserCreateSchema } from "@/lib/schemas";

export async function GET(request: Request) {
  try {
    await requireOperator(request, ["jefe"]);
    const rows = await prisma.operatorUser.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, email: true, name: true, role: true, active: true, lastLoginAt: true, createdAt: true },
    });
    return Response.json({ users: rows });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(request: Request) {
  try {
    const op = await requireOperator(request, ["jefe"]);
    const body = await request.json().catch(() => ({}));
    const parsed = operatorUserCreateSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Datos no válidos");
    const { email, name, role, password } = parsed.data;

    const dup = await prisma.operatorUser.findUnique({ where: { email }, select: { id: true } });
    if (dup) throw new ApiError(409, "Ya existe un operador con ese correo");

    const user = await prisma.operatorUser.create({
      data: { email, name, role, passwordHash: hashPassword(password) },
      select: { id: true, email: true, name: true, role: true, active: true },
    });
    logAudit(operatorActor(op), "user_create", { newId: user.id, email, role });
    return Response.json({ user });
  } catch (e) {
    return jsonError(e);
  }
}
