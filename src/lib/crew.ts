// ============================================================
//  Vinculación de Bombero Guardián con un carro
//  - El chofer agrega al bombero en la tablet y recibe un código.
//  - La app personal canjea el código por un token Bearer propio
//    (no usa la cookie de la tablet) y desde ahí lee/escribe el
//    chat real de la unidad.
// ============================================================

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "./db";
import { ApiError, jsonError } from "./errors";

const SECRET = process.env.JWT_SECRET || "fuegomap-dev-secret-cambiar";
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 h; se renueva canjeando el código otra vez
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin O/0/I/1
const CODE_LENGTH = 6;

// ---------- Tokens de tripulante (HS256, scope propio) ----------

interface CrewTokenPayload {
  scope: "crew";
  cid: number;
  uid: number;
  exp: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function signCrewToken(crewId: number, unitId: number): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      scope: "crew",
      cid: crewId,
      uid: unitId,
      exp: Date.now() + TOKEN_TTL_MS,
    } satisfies CrewTokenPayload),
  );
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
}

export function verifyCrewToken(token: string): CrewTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = sign(`${header}.${payload}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as CrewTokenPayload;
    if (parsed.scope !== "crew" || !parsed.cid || !parsed.uid) return null;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------- Códigos de vinculación ----------

function randomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeJoinCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
}

/** Crea la fila de tripulación con un código único (reintenta si choca). */
export async function createCrewMember(unitId: number, name: string, role: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await prisma.unitCrew.create({
        data: { unitId, name, role, joinCode: randomCode() },
      });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "P2002") continue; // colisión de código: probar otro
      throw e;
    }
  }
  throw new ApiError(500, "No se pudo generar el código de vinculación");
}

// ---------- Autorización del bombero (Bearer) ----------

export interface CrewAuth {
  crew: {
    id: number;
    unitId: number;
    name: string;
    role: string;
    status: string;
  };
  unit: { id: number; code: string; name: string };
}

export async function requireCrew(request: Request): Promise<CrewAuth> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new ApiError(401, "Falta el código de vinculación");
  const payload = verifyCrewToken(token);
  if (!payload) throw new ApiError(401, "Vínculo vencido — vuelve a ingresar el código del carro");

  const crew = await prisma.unitCrew.findFirst({
    where: { id: payload.cid, unitId: payload.uid, leftAt: null },
    select: {
      id: true,
      unitId: true,
      name: true,
      role: true,
      status: true,
      unit: { select: { id: true, code: true, name: true } },
    },
  });
  if (!crew) throw new ApiError(401, "Tu vínculo con el carro ya no está activo");
  return { crew, unit: crew.unit };
}

// ---------- CORS para la app personal (otro origen) ----------

function allowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const extra = (process.env.BOMBER_APP_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (extra.includes(origin)) return origin;
  if (process.env.APP_ORIGIN && origin === process.env.APP_ORIGIN) return origin;
  // Desarrollo local: la PWA corre en su propio puerto (3200, 5173…)
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}

export function crewCorsHeaders(request: Request): HeadersInit {
  const origin = allowedOrigin(request);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function crewJson(request: Request, data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: crewCorsHeaders(request) });
}

export function crewPreflight(request: Request): Response {
  return new Response(null, { status: 204, headers: crewCorsHeaders(request) });
}

/** Error con los mismos encabezados CORS (si no, el navegador lo oculta). */
export function crewError(request: Request, e: unknown): Response {
  const res = jsonError(e);
  const headers = new Headers(res.headers);
  new Headers(crewCorsHeaders(request)).forEach((value, key) => headers.set(key, value));
  return new Response(res.body, { status: res.status, headers });
}
