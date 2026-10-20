// Utilidades compartidas de unidades (cliente y servidor).

import type { IncidentDTO, UnitDTO } from "./types";

/** La unidad está saliendo o regresando: se considera «en salida» en la central */
export function isUnitEnSalida(status: UnitDTO["status"]): boolean {
  return status === "en_ruta" || status === "regresando";
}

/** Misión activa de la unidad: por relación directa o por asignación multi-unidad */
export function activeIncidentForUnit(
  unit: UnitDTO,
  incidents: IncidentDTO[],
): IncidentDTO | null {
  if (unit.incidentId != null) {
    const direct = incidents.find((i) => i.id === unit.incidentId);
    if (direct) return direct;
  }
  return (
    incidents.find(
      (i) =>
        (i.status === "despachado" || i.status === "en_escena") &&
        i.units?.some((a) => a.unitId === unit.id),
    ) ?? null
  );
}
