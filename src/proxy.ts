// ============================================================
//  Proxy de Next 16 (antes «middleware»): candado de la API.
//  Bloquea toda ruta /api/** que no sea pública o de la app de
//  unidades — el CAD requiere sesión de operador válida (JWT en
//  cookie httpOnly). Los endpoints además vuelven a verificar
//  contra la BD (requireOperator) — defensa en dos capas.
//  NOTA: runtime Node por defecto en Next 16, pero este archivo
//  permanece libre de Prisma (solo puro JWT).
// ============================================================

import { NextResponse, type NextRequest } from "next/server";
import { OPERATOR_COOKIE, verifyOperatorToken } from "@/lib/optoken";

// Público aunque nadie esté autenticado en la central:
//   /api/app/**            — canal abierto para bomberos sin sesión (solo incidente/hidrantes)
//   /api/units/auth/**     — login/logout + listado mínimo para el login de la PWA
//   /api/units/me/**       — APIs de la tablet (con SU propio JWT de sesión)
//   /api/missions/**       — cierre de misión desde la tablet (requireUnit propio)
//   /api/whatsapp/**       — webhook del bot (verificación del propio canal)
//   /api/media/**          — fotos de reportes (enlaces públicos compartidos por WhatsApp)
//   /api/push/**           — VAPID pública + suscripción web push de bomberos sin unidad
//   /api/operator/login    — el propio ingreso al CAD
const PUBLIC_API_PREFIXES = [
  "/api/app",
  "/api/units/auth",
  "/api/units/me",
  "/api/missions",
  "/api/whatsapp",
  "/api/media",
  "/api/push/key",
  "/api/push/subscription",
  "/api/operator/login",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const payload = await verifyOperatorToken(request.cookies.get(OPERATOR_COOKIE)?.value);
  if (payload) return NextResponse.next();

  return NextResponse.json(
    { error: "Central protegida — ingresa con tu cuenta de operador" },
    { status: 401 },
  );
}

export const config = {
  // Solo la API: las páginas llevan su propia puerta server-side
  // (page.tsx y /reportes verifican la sesión antes de renderizar).
  matcher: "/api/:path*",
};
