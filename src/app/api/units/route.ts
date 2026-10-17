// GET  /api/units — estado del parque de unidades
// POST /api/units — registrar una unidad nueva

import { connection } from "next/server";
import { jsonError } from "@/lib/errors";
import { createUnit, listUnits } from "@/lib/queries";

export async function GET() {
  await connection();
  try {
    return Response.json({ units: await listUnits() });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const unit = await createUnit({
      code: body.code,
      name: body.name,
      type: body.type,
      status: body.status,
      station: body.station,
      crew: body.crew,
      lat: body.lat,
      lng: body.lng,
    });
    return Response.json({ unit }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
