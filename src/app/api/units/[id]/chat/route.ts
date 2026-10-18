// GET  /api/units/[id]/chat — historial de chat con la unidad (la central)
// POST /api/units/[id]/chat — la central escribe a la unidad
// Ambos CON sesión de operador: el hilo de comando no es público.

import { ApiError, jsonError } from "@/lib/errors";
import { saveDataUrl } from "@/lib/media";
import { requireOperator } from "@/lib/opauth";
import { chatList, chatSend } from "@/lib/chat";
import { chatSchema } from "@/lib/schemas";

export async function GET(request: Request, ctx: RouteContext<"/api/units/[id]/chat">) {
  try {
    await requireOperator(request);
    const { id } = await ctx.params;
    const after = new URL(request.url).searchParams.get("after");
    const messages = await chatList(Number(id), after);
    return Response.json({ messages });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(request: Request, ctx: RouteContext<"/api/units/[id]/chat">) {
  try {
    await requireOperator(request, ["jefe", "operador"]);
    const { id } = await ctx.params;
    const payload = await request.json().catch(() => ({}));
    const parsed = chatSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Mensaje no válido");
    }
    // Nota de voz / llamado: el audio se guarda y el cuerpo queda marcado
    // (AUDIO:<url> = nota normal · LLAMADA:<url> = llamado con campana).
    // Si el operador escribió texto, se manda aparte como mensaje normal.
    let finalBody = parsed.data.body;
    if (parsed.data.audio) {
      const url = await saveDataUrl(parsed.data.audio);
      if (!url) throw new ApiError(400, "No se pudo guardar el audio");
      finalBody = `${parsed.data.urgent ? "LLAMADA:" : "AUDIO:"}${url}`;
      const message = await chatSend(Number(id), "central", finalBody);
      const caption = parsed.data.body.trim();
      if (caption && !caption.startsWith("🎤") && !caption.startsWith("📞")) {
        await chatSend(Number(id), "central", caption);
      }
      return Response.json({ message });
    }
    if (parsed.data.urgent) {
      finalBody = `LLAMADA:${parsed.data.body}`;
    }
    const message = await chatSend(Number(id), "central", finalBody);
    return Response.json({ message });
  } catch (e) {
    return jsonError(e);
  }
}
