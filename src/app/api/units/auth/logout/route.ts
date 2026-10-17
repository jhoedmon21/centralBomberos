// POST /api/units/auth/logout — cerrar sesión de la tablet (borra la cookie)

import { clearSessionCookieHeader } from "@/lib/auth";

export async function POST() {
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": clearSessionCookieHeader() } },
  );
}
