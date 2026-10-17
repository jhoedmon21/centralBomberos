// GET /api/units/me/mission — detalle de la misión activa de la unidad

import { connection } from "next/server";
import { ApiError, jsonError } from "@/lib/errors";
import { requireUnit, activeMission, missionPayload } from "@/lib/unitapp";

export async function GET(request: Request) {
  await connection();
  try {
    const auth = await requireUnit(request);
    const mission = await activeMission(auth.unitId);
    if (!mission) throw new ApiError(404, "No hay misión activa para esta unidad");
    return Response.json({ mission: await missionPayload(mission, auth.unitId) });
  } catch (e) {
    return jsonError(e);
  }
}
