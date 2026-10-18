// ============================================================
//  JWT del operador (central CAD) — módulo PURE: sin dependencias
//  (ni prisma ni node:crypto-NODE-ONLY). Lo usan tanto las rutas
//  API (node) como el proxy de Next 16 (src/proxy.ts), que corre
//  con runtime Node y donde NO conviene arrastrar el bundle de
//  Prisma. Sesión de 12 h, HS256 con el mismo JWT_SECRET.
// ============================================================

const SECRET = process.env.JWT_SECRET || "fuegomap-dev-secret-cambiar";
export const OPERATOR_COOKIE = "fm_op";
export const OPERATOR_MAX_AGE = 60 * 60 * 12; // 12 h — el CAD se cierra cada guardia

export interface OperatorPayload {
  uid: number;
  exp: number; // epoch ms
}

const enc = new TextEncoder();

function b64urlJson(value: unknown): string {
  const bytes = enc.encode(JSON.stringify(value));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(text: string): string {
  const pad = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4));
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** HMAC-SHA256 con Web Crypto — funciona en node y en edge/proxy */
async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  let bin = "";
  for (const b of new Uint8Array(sig)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function signOperatorSession(uid: number): Promise<string> {
  const header = b64urlJson({ alg: "HS256", typ: "JWT" });
  const payload = b64urlJson({ uid, exp: Date.now() + OPERATOR_MAX_AGE * 1000 } satisfies OperatorPayload);
  const sig = await hmac(`${header}.${payload}`);
  return `${header}.${payload}.${sig}`;
}

export async function verifyOperatorToken(token: string | null | undefined): Promise<OperatorPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [, payloadB64, signature] = parts;
  const expected = await hmac(`${parts[0]}.${payloadB64}`);
  if (signature !== expected) return null;
  try {
    const parsed = JSON.parse(fromB64url(payloadB64)) as OperatorPayload;
    if (!parsed.exp || parsed.exp < Date.now() || !Number.isInteger(parsed.uid)) return null;
    return parsed;
  } catch {
    return null;
  }
}
