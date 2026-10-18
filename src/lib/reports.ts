// ============================================================
//  Reportes de tiempos de respuesta (estilo ESO/records):
//  de cada incidente CERRADO en la ventana salen las fases con
//  los hitos reales de la BD:
//    despacho = dispatchAt − createdAt
//    ack      = acceptedAt − dispatchAt  (el ACK de 60 s de la app)
//    llegada  = arrivalAt − dispatchAt   (unidad marcó «en escena»)
//    atención = closedAt − createdAt
//  Se resumen con percentiles p50/p90, por severidad y por unidad.
//  Todo en MINUTES enteros (losacebook ciclos de rescate se piensan en min).
// ============================================================

import { prisma } from "./db";

const SEC = 1_000;
const MIN = 60_000;

export interface PhaseStatMin {
  n: number;
  p50: number | null;
  p90: number | null;
}

export interface ResponseReport {
  days: number;
  from: string;
  to: string;
  generatedAt: string;
  counts: {
    closed: number;
    active: number;
    bySeverity: Record<string, number>;
    bySource: Record<string, number>;
  };
  phases: { despacho: PhaseStatMin; ack: PhaseStatMin; llegada: PhaseStatMin; atencion: PhaseStatMin };
  bySeverity: Array<{ severity: string; n: number; llegadaP50: number | null; llegadaP90: number | null }>;
  byUnit: Array<{ unitId: number; code: string; n: number; ackP50: number | null }>;
  incidents: Array<{
    id: number;
    title: string;
    address: string;
    severity: string;
    at: string;
    dispatchMin: number | null;
    arrivalMin: number | null;
    totalMin: number | null;
    units: string[];
  }>;
}

function percentileMin(sortedSeconds: number[], p: number): number | null {
  if (sortedSeconds.length === 0) return null;
  const idx = Math.min(sortedSeconds.length - 1, Math.floor((p / 100) * sortedSeconds.length));
  return Math.max(1, Math.round(sortedSeconds[idx] * SEC / MIN));
}

function stat(seconds: number[]): PhaseStatMin {
  const sorted = [...seconds].sort((a, b) => a - b);
  return { n: sorted.length, p50: percentileMin(sorted, 50), p90: percentileMin(sorted, 90) };
}

function diffSec(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  const s = (b.getTime() - a.getTime()) / 1000;
  return s >= 0 ? s : null;
}

export async function buildResponseReport(days: number): Promise<ResponseReport> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 3600_000);

  const [closed, active] = await Promise.all([
    prisma.incident.findMany({
      where: { closedAt: { gte: from }, status: { in: ["controlado", "cerrado"] } },
      orderBy: { closedAt: "desc" },
      include: {
        unitAssignments: { include: { unit: { select: { code: true } } } },
        unit: { select: { code: true } },
      },
    }),
    prisma.incident.count({ where: { status: { in: ["reportado", "despachado", "en_escena"] } } }),
  ]);

  const despacho: number[] = [];
  const ack: number[] = [];
  const llegada: number[] = [];
  const atencion: number[] = [];
  const bySeverityAcc = new Map<string, number[]>();
  const bySource: Record<string, number> = {};

  for (const i of closed) {
    bySource[i.source] = (bySource[i.source] ?? 0) + 1;
    const d = diffSec(i.createdAt, i.dispatchAt);
    if (d != null) despacho.push(d);
    const a = diffSec(i.dispatchAt, i.acceptedAt);
    if (a != null) ack.push(a);
    const l = diffSec(i.dispatchAt, i.arrivalAt);
    if (l != null) {
      llegada.push(l);
      const arr = bySeverityAcc.get(i.severity) ?? [];
      arr.push(l);
      bySeverityAcc.set(i.severity, arr);
    }
    const t = diffSec(i.createdAt, i.closedAt);
    if (t != null) atencion.push(t);
  }

  // ACK por unidad: cada IncidentUnit tiene el acceptedAt de ESA unidad
  const byUnitAcc = new Map<number, { code: string; ack: number[] }>();
  const assigns = await prisma.incidentUnit.findMany({
    where: { incident: { closedAt: { gte: from }, status: { in: ["controlado", "cerrado"] } } },
    include: { unit: { select: { code: true } } },
  });
  for (const r of assigns) {
    const s = diffSec(r.dispatchedAt, r.acceptedAt);
    if (s == null) continue;
    const acc = byUnitAcc.get(r.unitId) ?? { code: r.unit.code, ack: [] };
    acc.ack.push(s);
    byUnitAcc.set(r.unitId, acc);
  }

  const bySeverity = ["critica", "alta", "media", "baja"]
    .filter((sev) => bySeverityAcc.has(sev))
    .map((sev) => ({ severity: sev, ...stat(bySeverityAcc.get(sev) ?? []) }))
    .map(({ severity, n, p50, p90 }) => ({ severity, n, llegadaP50: p50, llegadaP90: p90 }));

  const byUnit = [...byUnitAcc.entries()]
    .sort((a, b) => b[1].ack.length - a[1].ack.length)
    .map(([unitId, acc]) => ({ unitId, code: acc.code, n: acc.ack.length, ackP50: stat(acc.ack).p50 }));

  return {
    days,
    from: from.toISOString(),
    to: to.toISOString(),
    generatedAt: new Date().toISOString(),
    counts: {
      closed: closed.length,
      active,
      bySeverity: Object.fromEntries(
        ["critica", "alta", "media", "baja"]
          .map((sev) => [sev, closed.filter((i) => i.severity === sev).length])
          .filter(([, n]) => Number(n) > 0),
      ),
      bySource,
    },
    phases: {
      despacho: stat(despacho),
      ack: stat(ack),
      llegada: stat(llegada),
      atencion: stat(atencion),
    },
    bySeverity,
    byUnit,
    incidents: closed.slice(0, 30).map((i) => ({
      id: i.id,
      title: i.title,
      address: i.address,
      severity: i.severity,
      at: (i.dispatchAt ?? i.createdAt).toISOString(),
      dispatchMin: nullsToUndef((diffSec(i.createdAt, i.dispatchAt))) as number | null,
      arrivalMin: nullsToUndef(diffSec(i.dispatchAt, i.arrivalAt)) as number | null,
      totalMin: nullsToUndef(diffSec(i.createdAt, i.closedAt)) as number | null,
      units: i.unitAssignments.length
        ? i.unitAssignments.map((a) => a.unit.code)
        : i.unit?.code
          ? [i.unit.code]
          : [],
    })),
  };
}

// Los valores ya vienen en segundos; el informe se presenta en minutos
// enteros por incidente (redondeo hacia arriba: 1 s de despacho es «1 min»).
function nullsToUndef(v: number | null): number | null {
  return v == null ? null : Math.max(1, Math.round(v / 60));
}
