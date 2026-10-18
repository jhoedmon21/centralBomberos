// ============================================================
//  Autorización del operador de la central CAD.
//  El proxy (src/proxy.ts) verifica el JWT; aquí los endpoints
//  vuelven a verificar contra la BD (actor activo + rol vigente)
//  — patrón recomendado: confiar solo en la verificación por capa.
// ============================================================

import { cookies } from "next/headers";
import { prisma } from "./db";
import { ApiError } from "./errors";
import { OPERATOR_COOKIE, verifyOperatorToken } from "./optoken";

export type OperatorRole = "jefe" | "operador" | "lectura";

export const OPERATOR_ROLES: OperatorRole[] = ["jefe", "operador", "lectura"];

export interface OperatorAuth {
  id: number;
  name: string;
  email: string;
  role: OperatorRole;
}

const ROLE_LABEL: Record<OperatorRole, string> = {
  jefe: "jefe",
  operador: "operador",
  lectura: "lectura",
};

/** Etiqueta legible para la auditoría: «Op. Nombre · jefe» */
export function operatorActor(op: OperatorAuth): string {
  return `Op. ${op.name} · ${ROLE_LABEL[op.role] ?? op.role}`;
}

/** Lee la cookie del proxy/RSC y valida el token (sin tocar BD). */
export async function readOperatorCookie(request?: Request): Promise<OperatorPayloadLike | null> {
  let token: string | null = null;
  if (request) {
    const raw = request.headers.get("cookie");
    if (raw) {
      for (const part of raw.split(";")) {
        const idx = part.indexOf("=");
        if (part.slice(0, idx).trim() === OPERATOR_COOKIE) token = part.slice(idx + 1).trim();
      }
    }
  } else {
    const jar = await cookies();
    token = jar.get(OPERATOR_COOKIE)?.value ?? null;
  }
  const payload = await verifyOperatorToken(token);
  return payload ? { uid: payload.uid } : null;
}

interface OperatorPayloadLike {
  uid: number;
}

/**
 * Autentica al operador leyendo la cookie y COMPROBANDO la BD
 * (activo + rol vigente: un cambio de rol aplica al instante).
 * `allow`: roles permitidos para la acción; [] = cualquiera autenticado.
 */
export async function requireOperator(request: Request, allow: OperatorRole[] = []): Promise<OperatorAuth> {
  const session = await readOperatorCookie(request);
  if (!session) throw new ApiError(401, "Sesión de operador no válida — ingresa al CAD");
  const op = await prisma.operatorUser.findUnique({
    where: { id: session.uid },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!op || !op.active) throw new ApiError(401, "Operador desactivado — sesión cancelada");
  const auth: OperatorAuth = {
    id: op.id,
    name: op.name,
    email: op.email,
    role: (OPERATOR_ROLES.includes(op.role as OperatorRole) ? op.role : "lectura") as OperatorRole,
  };
  if (allow.length && !allow.includes(auth.role)) {
    throw new ApiError(403, `Requiere rol ${allow.join(" o ")}`);
  }
  return auth;
}
