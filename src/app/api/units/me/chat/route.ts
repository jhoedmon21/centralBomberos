// GET  /api/units/me/chat — historial de chat de esta unidad (la tablet)
// POST /api/units/me/chat — la unidad escribe a la central

import { ApiError, jsonError } from "@/lib/errors";
import { saveDataUrl } from "@/lib/media";
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
    const payload = await request.json().catch(() => ({}));
    const parsed = chatSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Mensaje no válido");
    }
    // Igual que del lado de la central: nota de voz / llamado marcado;
    // el texto escrito va aparte como mensaje normal (no se pierde).
    let finalBody = parsed.data.body;
    if (parsed.data.audio) {
      const url = await saveDataUrl(parsed.data.audio);
      if (!url) throw new ApiError(400, "No se pudo guardar el audio");
      finalBody = `${parsed.data.urgent ? "LLAMADA:" : "AUDIO:"}${url}`;
      const message = await chatSend(auth.unitId, "unidad", finalBody);
      const caption = parsed.data.body.trim();
      if (caption && !caption.startsWith("🎤") && !caption.startsWith("📞")) {
        await chatSend(auth.unitId, "unidad", caption);
      }
      return Response.json({ message });
    }
    if (parsed.data.urgent) {
      finalBody = `LLAMADA:${parsed.data.body}`;
    }
    const message = await chatSend(auth.unitId, "unidad", finalBody);
    return Response.json({ message });
  } catch (e) {
    return jsonError(e);
  }
}
