// GET  /api/hydrants — hidrantes georreferenciados
// POST /api/hydrants — registrar un hidrante (central o app en campo).
// Con opId (idempotencia) y foto opcional para la app sin internet.

import { connection } from "next/server";
import { ApiError, jsonError } from "@/lib/errors";
import { saveDataUrl } from "@/lib/media";
import { runIdempotent } from "@/lib/idem";
import { createHydrant, listHydrants } from "@/lib/queries";
import { hydrantNewSchema } from "@/lib/schemas";

export async function GET() {
  await connection();
  try {
    return Response.json({ hydrants: await listHydrants() });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = hydrantNewSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Datos no válidos");
    }
    const { code, lat, lng, pressure, diameter, situation, notes, photoBase64, opId } = parsed.data;
    const photoUrl = photoBase64 ? await saveDataUrl(photoBase64) : null;
    const result = await runIdempotent("hydrants", opId ?? null, "hydrant_new", async () => {
      const hydrant = await createHydrant({
        code,
        lat,
        lng,
        pressure,
        diameter,
        situation,
        notes,
        photoUrl,
      });
      return { hydrant };
    });
    return Response.json(result, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
