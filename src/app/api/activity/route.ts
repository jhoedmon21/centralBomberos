// GET /api/activity — bitácora global reciente (todas las incidencias)

import { connection } from "next/server";
import { jsonError } from "@/lib/errors";
import { getActivity } from "@/lib/queries";

export async function GET(request: Request) {
  await connection();
  try {
    const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? 40) || 40, 200);
    return Response.json({ activity: await getActivity(limit) });
  } catch (e) {
    return jsonError(e);
  }
}
