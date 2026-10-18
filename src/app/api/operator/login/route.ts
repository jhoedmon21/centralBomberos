// POST /api/operator/login — ingreso al CAD (jefe | operador | lectura).
// Con límite de intentos por correo+IP (5 fallos → 10 min bloqueado) y
// auditoría de todo acceso, exitoso o fallido.

import { ApiError, jsonError } from "@/lib/errors";
import { OPERATOR_COOKIE, OPERATOR_MAX_AGE, signOperatorSession } from "@/lib/optoken";
import { operatorActor } from "@/lib/opauth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/passwords";
import { operatorLoginSchema } from "@/lib/schemas";

const SECURE = process.env.NODE_ENV === "production";

// Límite simple en memoria (por instancia serverless): intentos fallidos
const attempts = globalThis as unknown as { __fmOpAttempts?: Map<string, { count: number; until: number }> };
const failMap = attempts.__fmOpAttempts ?? (attempts.__fmOpAttempts = new Map());
const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const ip = (request.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
    const body = await request.json().catch(() => ({}));
    const parsed = operatorLoginSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Datos no válidos");
    const { email, password } = parsed.data;

    const key = `${ip}|${email}`;
    const lock = failMap.get(key);
    if (lock && lock.count >= MAX_FAILS && Date.now() < lock.until) {
      const minutes = Math.ceil((lock.until - Date.now()) / 60_000);
      throw new ApiError(429, `Demasiados intentos fallidos — espera ${minutes} min`);
    }

    const op = await prisma.operatorUser.findUnique({ where: { email } });
    if (!op || !op.active || !verifyPassword(password, op.passwordHash)) {
      const rec = failMap.get(key) ?? { count: 0, until: 0 };
      failMap.set(key, {
        count: Date.now() < rec.until ? rec.count + 1 : 1,
        until: Date.now() + LOCK_MS,
      });
      logAudit(email, "login_fail", { ip });
      throw new ApiError(401, "Credenciales no válidas");
    }
    failMap.delete(key);

    await prisma.operatorUser.update({
      where: { id: op.id },
      data: { lastLoginAt: new Date() },
    });
    logAudit(operatorActor({ id: op.id, name: op.name, email: op.email, role: op.role as "jefe" }), "login", { ip });

    const token = await signOperatorSession(op.id);
    return Response.json(
      { operator: { id: op.id, name: op.name, email: op.email, role: op.role } },
      {
        headers: {
          "Set-Cookie": `${OPERATOR_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${OPERATOR_MAX_AGE}${SECURE ? "; Secure" : ""}`,
        },
      },
    );
  } catch (e) {
    return jsonError(e);
  }
}
