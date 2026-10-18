// GET  /api/units/me/chat — historial de chat de esta unidad (la tablet)
// POST /api/units/me/chat — la unidad escribe a la central

import { ApiError, jsonError } from "@/lib/errors";
import { chatList, chatSend } from "@/lib/chat";
import { requireUnit } from "@/lib/unitapp";
import { chatSchema } from "@/lib/schemas";

export async function GET(request: Request) {
  try {
    const auth = await requireUnit(request);
    const after = new URL(request.url).searchParams.get("after");
    const messages = await chatList(auth.unitId, after);
    return Response.json({ messages });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUnit(request);
    const body = await request.json().catch(() => ({}));
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Mensaje no válido");
    }
    const message = await chatSend(auth.unitId, "unidad", parsed.data.body);
    return Response.json({ message });
  } catch (e) {
    return jsonError(e);
  }
}
