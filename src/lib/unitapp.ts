// ============================================================
//  Consultas y reglas específicas de FuegoMap Unidades (PWA)
//  La unidad solo ve SU misión, SU equipo y los hidrantes.
// ============================================================

import type { Incident, Unit } from "@prisma/client";
import { getAuth, type Auth } from "./auth";
import { prisma } from "./db";
import { ApiError } from "./errors";
import { haversineM, nearestPreplan } from "./geo";
import { ACTIVE_STATUSES } from "./meta";
import { listHydrants, listRisks, toIncidentDTO, toUnitDTO } from "./queries";
import { listPreplans } from "./preplans";
import type { HydrantDTO, IncidentDTO, PreplanDTO, RiskDTO, UnitDTO, UnitItemDTO } from "./types";

/** Exige sesión de unidad válida; lanza 401 si no la hay */
export async function requireUnit(request: Request): Promise<Auth> {
  const auth = await getAuth(request);
  if (!auth) throw new ApiError(401, "Sesión no válida — vuelve a iniciar sesión");
  const unit = await prisma.unit.findUnique({ where: { id: auth.unitId }, select: { id: true } });
  if (!unit) throw new ApiError(401, "La unidad asignada ya no existe");
  return auth;
}

/** Misión activa de la unidad: primero por asignación (IncidentUnit —
 * despacho multi-unidad); respaldo: incidente con unitId directo (legado). */
export async function activeMission(unitId: number): Promise<Incident | null> {
  const byRow = await prisma.incidentUnit.findFirst({
    where: { unitId, incident: { status: { in: ACTIVE_STATUSES } } },
    orderBy: { dispatchedAt: "desc" },
    include: { incident: { include: { unit: true } } },
  });
  if (byRow) return byRow.incident;
  return prisma.incident.findFirst({
    where: { unitId, status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: "desc" },
    include: { unit: true },
  });
}

/** acceptedAt de la fila de asignación de una unidad (null si no aceptó aún) */
function incidentRowAcceptedAt(
  incidentId: number,
  unitId: number,
): Promise<Date | null> {
  return prisma.incidentUnit
    .findUnique({
      where: { incidentId_unitId: { incidentId, unitId } },
      select: { acceptedAt: true },
    })
    .then((r) => r?.acceptedAt ?? null);
}

export interface MissionHydrant extends HydrantDTO {
  meters: number;
}

export interface MissionRisk extends RiskDTO {
  meters: number;
}

/** Ficha de riesgo (preplan) ligada a la misión: la tablet la muestra en
 * escena para entrar con información del edificio (First Due). */
export interface MissionPreplan {
  preplan: PreplanDTO;
  /** Distancia del incidente al edificio precargado */
  meters: number;
}

export interface MissionPayload {
  incident: IncidentDTO;
  hydrants: MissionHydrant[];
  risks: MissionRisk[];
  /** Preplan activo si la escena cae a ≤300 m de un edificio precargado */
  preplan: MissionPreplan | null;
  /** Otras unidades despachadas a ESTE incidente (asignaciones reales) */
  otherUnits: Array<Pick<Unit, "code" | "name" | "status">>;
  /** Teléfono del reportante enmascarado (la unidad no ve el número completo) */
  reporterPhoneMasked: string;
  /** Punto de salida del vehículo (cuartel) — trayecto tipo Uber en la app */
  departure: { lat: number; lng: number; station: string; at: string | null } | null;
}

/** Detalle completo de la misión para la app: hidrantes y riesgos cercanos,
 * otras unidades despachadas al mismo incidente. `unitId` ajusta acceptedAt
 * a LA aceptación de esta unidad (cada unidad acepta por su lado). */
export async function missionPayload(
  incident: Incident & { unit?: Unit | null },
  unitId?: number,
): Promise<MissionPayload> {
  const [hydrants, risks, assignments, preplans] = await Promise.all([
    listHydrants(),
    listRisks(),
    prisma.incidentUnit.findMany({
      where: { incidentId: incident.id, unitId: { not: unitId ?? -1 } },
      include: { unit: { select: { code: true, name: true, status: true } } },
      orderBy: { dispatchedAt: "asc" },
    }),
    listPreplans(),
  ]);
  // Respaldo (incidentes legados sin asignaciones): unidades en curso.
  const otherUnits = assignments.length
    ? assignments.map((a) => a.unit)
    : await prisma.unit.findMany({
        where: { status: { in: ["en_ruta", "en_escena"] }, id: { not: incident.unitId ?? -1 } },
        select: { code: true, name: true, status: true },
        orderBy: { code: "asc" },
      }).then((rows) => rows.map(({ code, name, status }) => ({ code, name, status })));

  const nearHydrants: MissionHydrant[] = hydrants
    .map((h) => ({ ...h, meters: Math.round(haversineM(incident.lat, incident.lng, h.lat, h.lng)) }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, 6);

  const nearRisks: MissionRisk[] = risks
    .map((r) => ({ ...r, meters: Math.round(haversineM(incident.lat, incident.lng, r.lat, r.lng)) }))
    .filter((r) => r.meters <= 800)
    .sort((a, b) => a.meters - b.meters)
    .slice(0, 5);

  // Auto-ficha en escena (First Due), igual criterio que la central: preplan
  // activo más cercano a ≤300 m. La unidad lo recibe en la misión.
  const nearPreplan = nearestPreplan(incident.lat, incident.lng, preplans, 300);
  const preplan: MissionPreplan | null = nearPreplan
    ? { preplan: nearPreplan, meters: Math.round(haversineM(incident.lat, incident.lng, nearPreplan.lat, nearPreplan.lng)) }
    : null;

  const dto = toIncidentDTO(incident);
  // La aceptación que ve la unidad es LA SUYA (multi-unidad: coordinadora
  // y escena pueden aceptar en momentos distintos).
  let myAcceptedAt: string | null = dto.acceptedAt;
  if (unitId != null) {
    const myRow = incidentRowAcceptedAt(incident.id, unitId);
    myAcceptedAt = (await myRow)?.toISOString() ?? null;
  }
  const masked = dto.reporterPhone
    ? dto.reporterPhone.replace(/(\+\d{2})\s?\d(\d{2})\d+(\d{3})/, "$1 $2•• ••• $3")
    : "";
  return {
    incident: { ...dto, reporterPhone: null, reporterName: dto.reporterName, acceptedAt: myAcceptedAt },
    hydrants: nearHydrants,
    risks: nearRisks,
    preplan,
    otherUnits,
    reporterPhoneMasked: masked,
    departure:
      incident.departLat != null && incident.departLng != null
        ? {
            lat: incident.departLat,
            lng: incident.departLng,
            station: incident.unit?.station ?? "cuartel",
            at: incident.dispatchAt?.toISOString() ?? null,
          }
        : null,
  };
}

// ---------- Sync offline (hidrantes + equipo + configuración) ----------

export interface DangerZoneDTO {
  id: number;
  name: string;
  kind: string;
  level: "alto" | "medio" | "bajo";
  advisory: string | null;
  /** Tramo del camino peligroso: [[lat, lng], …] */
  path: [number, number][];
}

/** Convierte el GeoJSON LineString guardado (JSON) a [[lat,lng],…] */
function parseZonePath(raw: string): [number, number][] {
  try {
    const geo = JSON.parse(raw) as { coordinates?: [number, number][] };
    return (geo.coordinates ?? []).map(([lng, lat]) => [lat, lng] as [number, number]);
  } catch {
    return [];
  }
}

export async function listDangerZones(): Promise<DangerZoneDTO[]> {
  const rows = await prisma.dangerZone.findMany({ orderBy: { name: "asc" } });
  return rows.map((z) => ({
    id: z.id,
    name: z.name,
    kind: z.kind,
    level: z.level as DangerZoneDTO["level"],
    advisory: z.advisory,
    path: parseZonePath(z.path),
  }));
}

export interface SyncPayload {
  version: string;
  hydrants: HydrantDTO[];
  equipment: Array<UnitItemDTO & { checkedToday: boolean }>;
  /** Tramos peligrosos para el tránsito de la unidad (curvas, derrumbes…) */
  dangerZones: DangerZoneDTO[];
  config: {
    osrmBaseUrl: string;
    center: { lat: number; lng: number };
    zoom: number;
    coverageMeters: number;
    /** Teléfono de la central para el botón «Llamar al despachador» */
    dispatcherPhone: string;
  };
  serverTime: number;
}

/** Versión débil de los datos de sincronización (para ETag / 304) */
export async function syncVersion(unitId: number): Promise<string> {
  const [hydrants, items, checks, zones] = await Promise.all([
    prisma.hydrant.findMany({ select: { id: true } }),
    prisma.unitItem.findMany({ where: { unitId }, select: { updatedAt: true } }),
    prisma.equipmentCheck.count({ where: { unitId, day: dayKey() } }),
    prisma.dangerZone.findMany({ select: { id: true } }),
  ]);
  const maxItem = items.reduce((acc, i) => Math.max(acc, i.updatedAt.getTime()), 0);
  return `h${hydrants.length}:${hydrants.at(-1)?.id ?? 0}-i${items.length}:${maxItem}-c${checks}-z${zones.length}:${zones.at(-1)?.id ?? 0}`;
}

export async function syncPayload(unitId: number): Promise<SyncPayload> {
  const day = dayKey();
  const [hydrantRows, itemRows, checkRows, dangerZones] = await Promise.all([
    prisma.hydrant.findMany({ orderBy: { code: "asc" } }),
    prisma.unitItem.findMany({ where: { unitId }, orderBy: [{ compartment: "asc" }, { name: "asc" }] }),
    prisma.equipmentCheck.findMany({ where: { unitId, day }, select: { itemId: true } }),
    listDangerZones(),
  ]);
  const checked = new Set(checkRows.map((c) => c.itemId));

  return {
    version: await syncVersion(unitId),
    hydrants: hydrantRows.map((h) => ({
      id: h.id,
      code: h.code,
      lat: h.lat,
      lng: h.lng,
      pressure: h.pressure,
      diameter: h.diameter,
      situation: h.situation as HydrantDTO["situation"],
      notes: h.notes,
      photoUrl: h.photoUrl,
    })),
    equipment: itemRows.map((i) => ({
      id: i.id,
      unitId: i.unitId,
      name: i.name,
      category: i.category as UnitItemDTO["category"],
      quantity: i.quantity,
      condition: i.condition as UnitItemDTO["condition"],
      notes: i.notes,
      compartment: i.compartment,
      checkedToday: checked.has(i.id),
    })) as SyncPayload["equipment"],
    dangerZones,
    config: {
      osrmBaseUrl: process.env.OSRM_BASE_URL || "https://router.project-osrm.org",
      center: { lat: -16.6236, lng: -72.7106 },
      zoom: 15,
      coverageMeters: 6000,
      dispatcherPhone: process.env.DISPATCHER_PHONE ?? "",
    },
    serverTime: Date.now(),
  };
}

// ---------- Alertas para TODOS los bomberos (con o sin unidad) ----------
// Datos básicos de cada emergencia activa: todos los que tienen la app
// reciben la alerta; el detalle completo de misión queda para el chofer.

export interface BasicIncidentDTO {
  id: number;
  title: string;
  address: string;
  lat: number;
  lng: number;
  severity: IncidentDTO["severity"];
  status: IncidentDTO["status"];
  createdAt: string;
  dispatchAt: string | null;
  /** Unidad asignada — en la vista básica solo el código */
  unitCode: string | null;
}

export interface AlertsPayload {
  version: string;
  /** Emergencias activas (reportado | despachado | en_escena) */
  incidents: BasicIncidentDTO[];
  hydrants: HydrantDTO[];
  dangerZones: DangerZoneDTO[];
  config: SyncPayload["config"];
  serverTime: number;
}

/** Versión débil de las alertas (para ETag / 304) */
export async function alertsVersion(): Promise<string> {
  const [incidents, zones] = await Promise.all([
    prisma.incident.findMany({
      where: { status: { in: ACTIVE_STATUSES } },
      select: { id: true, updatedAt: true },
    }),
    prisma.dangerZone.findMany({ select: { id: true } }),
  ]);
  const maxUpd = incidents.reduce((acc, i) => Math.max(acc, i.updatedAt.getTime()), 0);
  return `a${incidents.length}:${maxUpd}-z${zones.length}`;
}

export async function alertsPayload(): Promise<AlertsPayload> {
  const [rows, hydrants, dangerZones] = await Promise.all([
    prisma.incident.findMany({
      where: { status: { in: ACTIVE_STATUSES } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { unit: { select: { code: true } } },
    }),
    listHydrants(),
    listDangerZones(),
  ]);
  return {
    version: await alertsVersion(),
    incidents: rows.map((i) => ({
      id: i.id,
      title: i.title,
      address: i.address,
      lat: i.lat,
      lng: i.lng,
      severity: i.severity as IncidentDTO["severity"],
      status: i.status as IncidentDTO["status"],
      createdAt: i.createdAt.toISOString(),
      dispatchAt: i.dispatchAt?.toISOString() ?? null,
      unitCode: i.unit?.code ?? null,
    })),
    hydrants,
    dangerZones,
    config: {
      osrmBaseUrl: process.env.OSRM_BASE_URL || "https://router.project-osrm.org",
      center: { lat: -16.6236, lng: -72.7106 },
      zoom: 15,
      coverageMeters: 6000,
      dispatcherPhone: process.env.DISPATCHER_PHONE ?? "",
    },
    serverTime: Date.now(),
  };
}

/** Fecha local YYYY-MM-DD (día del checklist) */
export function dayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** DTO de unidad con datos frescos para la propia app */
export async function unitDTO(unitId: number): Promise<UnitDTO> {
  const row = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      incidents: {
        where: { status: { in: ACTIVE_STATUSES } },
        select: { id: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: { select: { items: true } },
    },
  });
  if (!row) throw new ApiError(404, "Unidad no encontrada");
  return toUnitDTO(row);
}
