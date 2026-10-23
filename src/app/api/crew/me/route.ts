// GET /api/crew/me — estado del vínculo del bombero con su carro.

import { crewError, crewJson, crewPreflight, requireCrew } from "@/lib/crew";

export async function OPTIONS(request: Request) {
  return crewPreflight(request);
}

export async function GET(request: Request) {
  try {
    const auth = await requireCrew(request);
    return crewJson(request, {
      member: auth.crew,
      unit: auth.unit,
    });
  } catch (e) {
    return crewError(request, e);
  }
}
