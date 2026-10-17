// POST /api/units/auth/login — inicio de sesión de la tablet de la unidad
// Valida credenciales, confirma la unidad y deja la sesión en cookie httpOnly.

import { ApiError, jsonError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { verifyPassword, signSession, sessionCookieHeader } from "@/lib/auth";
import { toUnitDTO } from "@/lib/queries";
import { loginSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Datos no válidos");
    }
    const { email, password, unitCode } = parsed.data;

    const user = await prisma.appUser.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new ApiError(401, "Correo o clave incorrectos");
    }

    // Bombero sin unidad (jefe de guardia): sesión general — alertas y vista
    // básica de todas las emergencias, sin misión ni manejo de vehículo.
    if (!unitCode) {
      if (user.role === "unidad") {
        throw new ApiError(400, "Como conductor debes confirmar tu unidad");
      }
      const token = signSession(user.id, 0, user.role, user.tokenVersion, 0);
      return Response.json(
        { user: { id: user.id, name: user.name, email: user.email, role: user.role }, unit: null },
        { headers: { "Set-Cookie": sessionCookieHeader(token) } },
      );
    }

    // Confirmar la unidad que conduce hoy (una persona puede turnarse en varias)
    const unit = await prisma.unit.findUnique({
      where: { code: unitCode },
      include: {
        incidents: { where: { status: { in: ["reportado", "despachado", "en_escena"] } }, select: { id: true }, take: 1 },
        _count: { select: { items: true } },
      },
    });
    if (!unit) throw new ApiError(404, `No existe la unidad ${unitCode}`);

    const token = signSession(user.id, unit.id, user.role, user.tokenVersion, unit.sessionEpoch);
    return Response.json(
      {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        unit: toUnitDTO(unit),
      },
      { headers: { "Set-Cookie": sessionCookieHeader(token) } },
    );
  } catch (e) {
    return jsonError(e);
  }
}
