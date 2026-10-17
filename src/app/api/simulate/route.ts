// POST /api/simulate — simula un reporte ciudadano por WhatsApp (modo demo)

import { jsonError } from "@/lib/errors";
import { simulateCitizenReport } from "@/lib/queries";

export async function POST() {
  try {
    const incident = await simulateCitizenReport();
    return Response.json({ incident }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
