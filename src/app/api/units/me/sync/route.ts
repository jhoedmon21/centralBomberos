// GET /api/units/me/sync — datos para trabajar sin internet:
// hidrantes de la zona, checklist del vehículo y configuración de mapa.
// Con ETag: si nada cambió, responde 304 y la tablet no descarga de más.

import { connection } from "next/server";
import { jsonError } from "@/lib/errors";
import { requireUnit, syncPayload, syncVersion } from "@/lib/unitapp";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUnit(request);
    const etag = `"fm-sync-${await syncVersion(auth.unitId)}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }
    const payload = await syncPayload(auth.unitId);
    return Response.json(payload, { headers: { ETag: etag, "Cache-Control": "no-cache" } });
  } catch (e) {
    return jsonError(e);
  }
}
