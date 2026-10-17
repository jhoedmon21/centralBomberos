// ============================================================
//  Autenticación de la app FuegoMap Unidades
//  - Contraseñas: scrypt (node:crypto, sin dependencias externas)
//  - Sesión: JWT HS256 firmado con HMAC, en cookie httpOnly
//  - Cierre remoto: tokenVersion (incrementarlo invalida los JWT previos)
// ============================================================

import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "./db";
import { hashPassword, verifyPassword } from "./passwords";

export { hashPassword, verifyPassword };

const SECRET = process.env.JWT_SECRET || "fuegomap-dev-secret-cambiar";
export const SESSION_COOKIE = "fm_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 días (renovable al usar la app)
const SECURE = process.env.NODE_ENV === "production"; // HTTPS obligatorio en producción

// ---------- JWT mínimo (HS256) ----------

export interface SessionPayload {
  uid: number;
  unitId: number;
  role: string;
  v: number; // tokenVersion del usuario al emitir
  uv: number; // sessionEpoch de la unidad al emitir
  exp: number; // epoch ms
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function signSession(
  uid: number,
  unitId: number,
  role: string,
  tokenVersion: number,
  unitEpoch: number,
): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      uid,
      unitId,
      role,
      v: tokenVersion,
      uv: unitEpoch,
      exp: Date.now() + SESSION_MAX_AGE * 1000,
    } satisfies SessionPayload),
  );
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = sign(`${header}.${payload}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionPayload;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------- Cookies (httpOnly · SameSite=Lax · 30 días) ----------

export function sessionCookieHeader(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${SECURE ? "; Secure" : ""}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${SECURE ? "; Secure" : ""}`;
}

// ---------- Lectura de sesión desde una Request ----------

function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

export interface Auth {
  uid: number;
  unitId: number;
  role: string;
  name: string;
}

/**
 * Verifica la cookie de sesión contra la base: valida el JWT, que el
 * usuario siga activo y que tokenVersion (usuario) + sessionEpoch
 * (unidad) coincidan — así la central puede cerrar sesiones remotas
 * de una tablet concreta.
 */
export async function getAuth(request: Request): Promise<Auth | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;

  // Sesión de bombero SIN unidad (jefe de guardia): solo depende del usuario
  if (payload.unitId === 0) {
    const user = await prisma.appUser.findUnique({
      where: { id: payload.uid },
      select: { id: true, name: true, role: true, tokenVersion: true },
    });
    if (!user || user.tokenVersion !== payload.v) return null;
    return { uid: user.id, unitId: 0, role: user.role, name: user.name };
  }

  const [user, unit] = await Promise.all([
    prisma.appUser.findUnique({
      where: { id: payload.uid },
      select: { id: true, name: true, role: true, tokenVersion: true },
    }),
    prisma.unit.findUnique({
      where: { id: payload.unitId },
      select: { sessionEpoch: true },
    }),
  ]);
  if (!user || !unit) return null;
  if (user.tokenVersion !== payload.v || unit.sessionEpoch !== payload.uv) return null;
  return { uid: user.id, unitId: payload.unitId, role: user.role, name: user.name };
}
