// GET  /api/units/[id]/chat — historial de chat con la unidad (la central)
// POST /api/units/[id]/chat — la central escribe a la unidad
// Ambos CON sesión de operador: el hilo de comando no es público.

import { ApiError, jsonError } from "@/lib/errors";
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
    const body = await request.json().catch(() => ({}));
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.issues[0]?.message ?? "Mensaje no válido");
    }
    const message = await chatSend(Number(id), "central", parsed.data.body);
    return Response.json({ message });
  } catch (e) {
    return jsonError(e);
  }
}
