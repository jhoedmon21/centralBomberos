// GET /reportes — informe de tiempos de respuesta estilo ESO/records:
// fases con p50/p90, distribución por severidad y por unidad + detalle
// de los últimos 30 cierres. Servidor directo (sin API intermedia).
// Ruta BLOQUEANTE (instant = false): todo el informe depende de la sesión
// (cookies) y de la BD — sin valor prerenderizarla.

export const instant = false;

import { cookies } from "next/headers";
import Link from "next/link";
import { ChartBar, Printer } from "@phosphor-icons/react/dist/ssr";
import { OPERATOR_COOKIE, verifyOperatorToken } from "@/lib/optoken";
import { prisma } from "@/lib/db";
import { buildResponseReport } from "@/lib/reports";
import PrintButton from "@/components/PrintButton";

const CHIPS: Array<[number, string]> = [
  [7, "7 días"],
  [30, "30 días"],
  [90, "90 días"],
];

function fmtMin(m: number | null): string {
  return m == null ? "—" : `${m} min`;
}

const SEV_LABEL: Record<string, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  // Sesión del operador (mismo JWT que el proxy); sin ella, fuera.
  const session = await verifyOperatorToken((await cookies()).get(OPERATOR_COOKIE)?.value);
  if (!session) {
    return (
      <main className="tac-grid flex h-dvh items-center justify-center bg-bg">
        <div className="text-center">
          <p className="display text-xl font-bold">Sesión requerida</p>
          <p className="mt-1 text-[13px] text-mu">
            <Link href="/" className="underline">
              Vuelve a la central
            </Link>{" "}
            e ingresa con tu cuenta de operador.
          </p>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const days = [7, 30, 90].includes(Number(params.days)) ? Number(params.days) : 30;
  const report = await buildResponseReport(days);
  const op = await prisma.operatorUser.findUnique({ where: { id: session.uid }, select: { name: true, role: true } });

  return (
    <main className="tac-grid min-h-dvh bg-bg px-4 py-6 print:px-0">
      <div className="mx-auto max-w-3xl">
        <div className="no-print flex items-center gap-2">
          <Link href="/" className="btn btn-sm">
            ← Central
          </Link>
          <div className="flex-1" />
          {CHIPS.map(([d, label]) => (
            <Link
              key={d}
              href={`/reportes?days=${d}`}
              className={`btn btn-sm ${days === d ? "border-amber/60 bg-amber/10 text-tx" : "text-mu hover:text-tx"}`}
            >
              {label}
            </Link>
          ))}
          <PrintButton />
        </div>

        <header className="mt-5 flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded border border-red/60 bg-panel">
            <ChartBar size={20} className="text-red" aria-hidden="true" />
          </span>
          <div>
            <h1 className="display text-2xl font-bold tracking-wide">
              Informe de tiempos de respuesta
            </h1>
            <p className="text-[12px] tracking-widest text-mu uppercase">
              Cuerpo de Bomberos B-35 Camaná · últimas {days} días · generado para {op?.name ?? "operador"}
            </p>
          </div>
          <span className="no-print ml-auto hidden items-center gap-1 text-[11px] text-mu2 lg:flex">
            <Printer size={13} aria-hidden="true" /> «Imprimir» → Guardar como PDF
          </span>
        </header>

        {/* Resumen de cierre */}
        <section className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded border border-line bg-panel px-3 py-2.5">
            <p className="text-[10px] track-widest text-mu uppercase">Cerrados en el periodo</p>
            <p className="display text-2xl font-bold">{report.counts.closed}</p>
          </div>
          <div className="rounded border border-line bg-panel px-3 py-2.5">
            <p className="text-[10px] track-widest text-mu uppercase">Activos ahora</p>
            <p className="display text-2xl font-bold">{report.counts.active}</p>
          </div>
          {(["critica", "alta", "media", "baja"] as const)
            .filter((sev) => report.counts.bySeverity[sev])
            .slice(0, 2)
            .map((sev) => (
              <div key={sev} className="rounded border border-line bg-panel px-3 py-2.5">
                <p className="text-[10px] track-widest text-mu uppercase">Cerrados {SEV_LABEL[sev].toLowerCase()}</p>
                <p className="display text-2xl font-bold">{report.counts.bySeverity[sev]}</p>
              </div>
            ))}
        </section>

        {/* Fases */}
        <h2 className="display mt-6 text-base font-bold uppercase tracking-wider">
          Fases de la respuesta (percentiles)
        </h2>
        <table className="mt-2 w-full border-collapse overflow-hidden rounded border border-line text-[13px]">
          <thead>
            <tr className="border-b border-line bg-panel2 text-left text-[10.5px] tracking-widest text-mu uppercase">
              <th className="px-3 py-2">Fase</th>
              <th className="px-3 py-2">Muestras</th>
              <th className="px-3 py-2">Mediana P50</th>
              <th className="px-3 py-2">P90</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["Despacho (alarma → salida)", report.phases.despacho],
                ["ACK de la unidad (salida → acepta)", report.phases.ack],
                ["Llegada a la escena (salida → en escena)", report.phases.llegada],
                ["Atención total (alarma → cierre)", report.phases.atencion],
              ] as [string, typeof report.phases.despacho][]
            ).map(([label, stat]) => (
              <tr key={label} className="border-b border-line last:border-0">
                <td className="px-3 py-2">{label}</td>
                <td className="px-3 py-2 font-mono">{stat.n}</td>
                <td className="px-3 py-2 font-mono font-bold">{fmtMin(stat.p50)}</td>
                <td className="px-3 py-2 font-mono text-amber">{fmtMin(stat.p90)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Por severidad */}
        {report.bySeverity.length > 0 && (
          <>
            <h2 className="display mt-6 text-base font-bold uppercase tracking-wider">Llegada por severidad</h2>
            <table className="mt-2 w-full border-collapse overflow-hidden rounded border border-line text-[13px]">
              <thead>
                <tr className="border-b border-line bg-panel2 text-left text-[10.5px] tracking-widest text-mu uppercase">
                  <th className="px-3 py-2">Severidad</th>
                  <th className="px-3 py-2">Cierres</th>
                  <th className="px-3 py-2">Llegada P50</th>
                  <th className="px-3 py-2">P90</th>
                </tr>
              </thead>
              <tbody>
                {report.bySeverity.map((row) => (
                  <tr key={row.severity} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">{SEV_LABEL[row.severity] ?? row.severity}</td>
                    <td className="px-3 py-2 font-mono">{row.n}</td>
                    <td className="px-3 py-2 font-mono font-bold">{fmtMin(row.llegadaP50)}</td>
                    <td className="px-3 py-2 font-mono text-amber">{fmtMin(row.llegadaP90)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Por unidad */}
        {report.byUnit.length > 0 && (
          <>
            <h2 className="display mt-6 text-base font-bold uppercase tracking-wider">ACK por unidad</h2>
            <table className="mt-2 w-full border-collapse overflow-hidden rounded border border-line text-[13px]">
              <thead>
                <tr className="border-b border-line bg-panel2 text-left text-[10.5px] tracking-widest text-mu uppercase">
                  <th className="px-3 py-2">Unidad</th>
                  <th className="px-3 py-2">Despachos atendidos</th>
                  <th className="px-3 py-2">ACK p50</th>
                </tr>
              </thead>
              <tbody>
                {report.byUnit.map((row) => (
                  <tr key={row.unitId} className="border-b border-line last:border-0">
                    <td className="display px-3 py-2 font-bold">{row.code}</td>
                    <td className="px-3 py-2 font-mono">{row.n}</td>
                    <td className="px-3 py-2 font-mono text-amber">{fmtMin(row.ackP50)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Detalle de cierres */}
        {report.incidents.length > 0 && (
          <>
            <h2 className="display mt-6 text-base font-bold uppercase tracking-wider">
              Últimos cierres (hasta 30)
            </h2>
            <table className="mt-2 w-full border-collapse overflow-hidden rounded border border-line text-[12.5px]">
              <thead>
                <tr className="border-b border-line bg-panel2 text-left text-[10.5px] tracking-widest text-mu uppercase">
                  <th className="px-3 py-2">Despacho</th>
                  <th className="px-3 py-2">Reporte</th>
                  <th className="px-3 py-2">Dirección</th>
                  <th className="px-3 py-2">Desp.</th>
                  <th className="px-3 py-2">Lleg.</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Unidades</th>
                </tr>
              </thead>
              <tbody>
                {report.incidents.map((i) => (
                  <tr key={i.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-1.5 whitespace-nowrap text-mu">
                      {new Date(i.at).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-1.5 font-semibold">
                      EM-{String(i.id).padStart(4, "0")} · {i.title}
                    </td>
                    <td className="px-3 py-1.5 text-mu">{i.address}</td>
                    <td className="px-3 py-1.5 font-mono">{fmtMin(i.dispatchMin)}</td>
                    <td className="px-3 py-1.5 font-mono">{fmtMin(i.arrivalMin)}</td>
                    <td className="px-3 py-1.5 font-mono">{fmtMin(i.totalMin)}</td>
                    <td className="px-3 py-1.5 font-mono text-mu">{i.units.join(" ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <footer className="mt-6 flex items-center gap-2 border-t border-line pt-3 text-[11px] text-mu2">
          <ChartBar size={13} aria-hidden="true" />
          Datos de la bitácora del CAD (despachos, ACK de la app y «en escena» reales de las unidades).
          Informe generado el {new Date(report.generatedAt).toLocaleString("es-PE")}.
        </footer>
      </div>
    </main>
  );
}
