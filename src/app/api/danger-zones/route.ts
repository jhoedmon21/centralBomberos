// GET /api/danger-zones — tramos de vía peligrosos para las unidades
// (curvas, pendientes, derrumbes…) con su geometría GeoJSON.

import { connection } from "next/server";
import { jsonError } from "@/lib/errors";
import { listDangerZones } from "@/lib/unitapp";

export async function GET() {
  await connection();
  try {
    return Response.json({ dangerZones: await listDangerZones() });
  } catch (e) {
    return jsonError(e);
  }
}
