// GET   /api/incidents/[id] — detalle con bitácora
// PATCH /api/incidents/[id] — editar el reporte (datos, foto) / estado / severidad / notas

import { connection } from "next/server";
import { jsonError } from "@/lib/errors";
import { saveDataUrl } from "@/lib/media";
import { getIncident, updateIncident } from "@/lib/queries";
import type { IncidentStatus, Severity } from "@/lib/types";

export async function GET(_req: Request, ctx: RouteContext<"/api/incidents/[id]">) {
  await connection();
  try {
    const { id } = await ctx.params;
    return Response.json({ incident: await getIncident(Number(id)) });
  } catch (e) {
    return jsonError(e);
  }
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/incidents/[id]">) {
  try {
    const { id } = await ctx.params;
    const raw = await request.json().catch(() => ({}));
    const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    // Foto: data URL nueva → archivo; o quitar la existente (removePhoto: true)
    let photoUrl: string | null | undefined;
    if (body.removePhoto === true) photoUrl = null;
    else if (typeof body.photoBase64 === "string" && body.photoBase64) {
      photoUrl = (await saveDataUrl(body.photoBase64)) ?? undefined;
    }
    const incident = await updateIncident(
      Number(id),
      {
        status: body.status as IncidentStatus | undefined,
        severity: body.severity as Severity | undefined,
        notes: body.notes as string | null | undefined,
        title: typeof body.title === "string" ? body.title : undefined,
        address: typeof body.address === "string" ? body.address : undefined,
        lat: body.lat === undefined ? undefined : Number(body.lat),
        lng: body.lng === undefined ? undefined : Number(body.lng),
        reporterName: "reporterName" in body ? (body.reporterName as string | null) : undefined,
        reporterPhone: "reporterPhone" in body ? (body.reporterPhone as string | null) : undefined,
        photoUrl,
      },
      typeof body.actor === "string" ? body.actor : "operador",
    );
    return Response.json({ incident });
  } catch (e) {
    return jsonError(e);
  }
}
