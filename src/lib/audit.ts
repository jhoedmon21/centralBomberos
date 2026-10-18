// ============================================================
//  Auditoría del CAD: registro a prueba de fallos — si falla la
//  escritura del AuditLog el negocio sigue; NUNCA rompe la acción.
// ============================================================

import { prisma } from "./db";

export function logAudit(actor: string, action: string, detail?: unknown): void {
  void prisma.auditLog
    .create({
      data: {
        actor,
        action,
        detail: detail === undefined ? null : JSON.stringify(detail),
      },
    })
    .catch(() => {
      /* la auditoría nunca interrumpe la operación */
    });
}
