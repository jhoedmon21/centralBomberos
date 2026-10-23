// GET  /api/crew/chat — historial del chat de la unidad
// POST /api/crew/chat — el bombero escribe (queda firmado con su nombre)

import { chatList, chatSend } from "@/lib/chat";
import { crewError, crewJson, crewPreflight, requireCrew } from "@/lib/crew";
import { ApiError } from "@/lib/errors";

export async function OPTIONS(request: Request) {
  return crewPreflight(request);
}

export async function GET(request: Request) {
  try {
    const auth = await requireCrew(request);
    const after = new URL(request.url).searchParams.get("after");
    return crewJson(request, { messages: await chatList(auth.unit.id, after) });
  } catch (e) {
    return crewError(request, e);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireCrew(request);
    const payload = await request.json().catch(() => ({}));
    const body = String((payload as { body?: string }).body ?? "").trim();
    if (!body) throw new ApiError(400, "Escribe un mensaje");
    if (body.length > 500) throw new ApiError(400, "Mensaje demasiado largo (máx. 500)");
    const message = await chatSend(auth.unit.id, "unidad", `${auth.crew.name}: ${body}`);
    return crewJson(request, { message });
  } catch (e) {
    return crewError(request, e);
  }
}
