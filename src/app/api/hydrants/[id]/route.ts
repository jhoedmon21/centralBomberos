// PATCH /api/hydrants/[id] — actualizar situación, presión, diámetro,
// notas o foto. Acepta opId (idempotencia de la cola sin internet).

import { ApiError, jsonError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { runIdempotent } from "@/lib/idem";
import { saveDataUrl } from "@/lib/media";
import { updateHydrant } from "@/lib/queries";
import { hydrantStatusSchema } from "@/lib/schemas";
import type { HydrantDTO } from "@/lib/types";

export async function PATCH(request: Request, ctx: RouteContext<"/api/hydrants/[id]">) {
  try {
    const { id } = await ctx.params;
    const hydrantId = Number(id);
    const body = await request.json().catch(() => ({}));

    // Cambio de estado desde la app (con opId) o edición completa desde la central
    const isUnitCall = hydrantStatusSchema.safeParse(body).success && "situation" in body;
    if (isUnitCall) {
      const parsed = hydrantStatusSchema.parse(body);
      const photoUrl = parsed.photoBase64 ? await saveDataUrl(parsed.photoBase64) : undefined;
      const result = await runIdempotent("hydrants", parsed.opId ?? null, "hydrant_status", async () => {
        const hydrant = await updateHydrant(hydrantId, {
          situation: parsed.situation,
          notes: parsed.notes,
          ...(photoUrl !== undefined ? { photoUrl } : {}),
        });
        return { hydrant };
      });
      return Response.json(result);
    }

    // Edición desde la central (formato original, sin opId)
    const hydrant = await updateHydrant(hydrantId, {
      pressure: body.pressure,
      diameter: body.diameter,
      situation: body.situation,
      notes: body.notes,
      photoUrl: body.photoUrl,
    });
    return Response.json({ hydrant: hydrant as HydrantDTO });
  } catch (e) {
    return jsonError(e);
  }
}
