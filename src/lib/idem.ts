// ============================================================
//  Idempotencia de operaciones de la app (cola sin internet)
//  El cliente envía un opId único por acción; si el reintento
//  llega después de que la operación ya se aplicó, se devuelve
//  la MISMA respuesta guardada sin volver a ejecutarla.
// ============================================================

import { prisma } from "./db";

export async function runIdempotent<T>(
  scope: string,
  opId: string | null | undefined,
  kind: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!opId) return fn(); // la central (admin) no usa opId

  const existing = await prisma.operation.findUnique({
    where: { scope_opId: { scope, opId } },
  });
  if (existing) return JSON.parse(existing.response) as T;

  const result = await fn();
  try {
    await prisma.operation.create({
      data: { scope, opId, kind, response: JSON.stringify(result) },
    });
  } catch {
    // Carrera: otro reintento la registró primero — el resultado es el mismo
  }
  return result;
}
