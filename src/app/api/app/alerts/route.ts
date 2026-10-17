// GET /api/app/alerts — emergencias activas PARA TODOS los bomberos que
// abran la app, SIN credenciales: datos básicos de cada incidente (sin
// reportante, fotos ni notas — solo lo que la compañía hace público)
// más hidrantes y zonas peligrosas para el mapa. Con ETag: si nada
// cambió, responde 304 y el cliente no descarga de más.
// El detalle completo (fotos, ruta, bitácora) sigue pidiendo sesión de
// chofer en /api/units/me/mission.

import { connection } from "next/server";
import { jsonError } from "@/lib/errors";
import { alertsPayload, alertsVersion } from "@/lib/unitapp";

export async function GET(request: Request) {
  await connection();
  try {
    const etag = `"fm-alerts-${await alertsVersion()}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }
    const payload = await alertsPayload();
    return Response.json(payload, { headers: { ETag: etag, "Cache-Control": "no-cache" } });
  } catch (e) {
    return jsonError(e);
  }
}
