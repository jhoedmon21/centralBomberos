// GET  /api/incidents  — lista de incidentes
// POST /api/incidents  — crear reporte (manual o desde el cliente)

import { connection } from "next/server";
import { ApiError, jsonError } from "@/lib/errors";
import { saveDataUrl } from "@/lib/media";
import { createIncident, listIncidents } from "@/lib/queries";

export async function GET() {
  await connection();
  try {
    return Response.json({ incidents: await listIncidents() });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") throw new ApiError(400, "Cuerpo JSON inválido");
    // Foto adjunta desde la central (registro manual): data URL -> archivo
    let photoUrl: string | null = typeof body.photoUrl === "string" && body.photoUrl ? body.photoUrl : null;
    if (!photoUrl && typeof body.photoBase64 === "string" && body.photoBase64) {
      photoUrl = await saveDataUrl(body.photoBase64);
    }
    const incident = await createIncident({ ...body, photoUrl, source: body.source ?? "manual" });
    return Response.json({ incident }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
