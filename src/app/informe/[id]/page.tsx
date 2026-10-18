// GET /informe/[id] — «Parte de emergencia» imprimible (A4): datos del
// incidente, unidades intervinientes, hidrantes cercanos, evidencia y
// bitácora completa. Se guarda como PDF con «Imprimir» del navegador —
// sin dependencias externas ni servicios de pago.
// Ruta DISPENSADA de la validación «instant»: el PDF se imprime con TODOS
// los datos cargados (no importa que la navegación bloquee unos ms).

export const instant = false;

import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import PrintBar from "./print-bar";
import { nearestHydrants } from "@/lib/geo";
import {
  HYDRANT_SITUATION_META,
  SEVERITY_META,
  SOURCE_META,
  STATUS_META,
  UNIT_STATUS_META,
} from "@/lib/meta";
import { OPERATOR_COOKIE, verifyOperatorToken } from "@/lib/optoken";
import { getIncident, listHydrants } from "@/lib/queries";
import { displayCode, fmtCoords, fmtDateTime, fmtDistance, hydrantLabel, maskPhone } from "@/lib/utils";

const EVENT_TYPE_LABEL: Record<string, string> = {
  creado: "Reporte recibido",
  despacho: "Despacho",
  llegada: "Llegada a escena",
  estado: "Cambio de estado",
  mensaje: "Mensaje",
  nota: "Nota",
  cierre: "Cierre",
};

const ACTOR_LABEL: Record<string, string> = {
  operador: "Operador",
  ciudadano: "Ciudadano",
  unidad: "Unidad",
  sistema: "Sistema",
};

function fmtDur(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[#d5d9de] py-1.5">
      <div className="text-[9px] font-bold tracking-[0.12em] text-[#5a626b] uppercase">{label}</div>
      <div className="text-[12.5px] leading-snug text-[#111]">{children}</div>
    </div>
  );
}

export default async function InformePage(props: PageProps<"/informe/[id]">) {
  // El parte lleva datos operativos (direcciones, dotación, bitácora):
  // exige sesión de operador como el resto del CAD.
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

  const { id } = await props.params;
  const incident = await getIncident(Number(id)).catch(() => null);
  if (!incident) notFound();

  const code = displayCode(incident.id, incident.createdAt);
  const hydrants = nearestHydrants(incident.lat, incident.lng, await listHydrants(), 5);
  const closedMs =
    incident.closedAt ? new Date(incident.closedAt).getTime() - new Date(incident.createdAt).getTime() : null;
  const units = incident.units ?? [];

  return (
    <>
      <PrintBar code={code} />
      <div className="min-h-screen bg-bg p-4 sm:p-8 print:bg-white print:p-0">
        <article className="fw-informe mx-auto max-w-[820px] bg-white p-8 text-[#111] shadow-2xl print:max-w-none print:p-0 print:shadow-none">
          {/* Encabezado */}
          <header className="flex items-start justify-between gap-4 border-b-2 border-[#111] pb-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded border-2 border-[#b3261c] text-2xl">
                🔥
              </span>
              <div>
                <div className="text-[17px] font-bold tracking-[0.08em]">COMPAÑÍA DE BOMBEROS B-35 · CAMANÁ</div>
                <div className="text-[11px] tracking-[0.18em] text-[#5a626b] uppercase">
                  Cuerpo General de Bomberos Voluntarios del Perú
                </div>
                <div className="text-[11px] tracking-[0.18em] text-[#5a626b] uppercase">
                  Jr. N. de Piérola 308 — Central de Mando GIS
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold tracking-[0.22em] text-[#5a626b] uppercase">Parte de emergencia</div>
              <div className="font-mono text-[16px] font-bold">{code}</div>
              <div className="mt-1 inline-block border border-[#111] px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                {STATUS_META[incident.status].label}
              </div>
            </div>
          </header>

          {/* Título del incidente */}
          <h2 className="mt-4 text-[19px] leading-tight font-bold">{incident.title}</h2>

          {/* Datos del reporte */}
          <section className="mt-4 grid grid-cols-2 gap-x-8 sm:grid-cols-3">
            <Field label="Fecha y hora del reporte">{fmtDateTime(incident.createdAt)}</Field>
            <Field label="Dirección de la emergencia">{incident.address}</Field>
            <Field label="Coordenadas">{fmtCoords(incident.lat, incident.lng)}</Field>
            <Field label="Origen del reporte">{SOURCE_META[incident.source].label}</Field>
            <Field label="Severidad declarada">{SEVERITY_META[incident.severity].label}</Field>
            <Field label="Reportante">
              {incident.reporterName ?? "Anónimo"}
              {incident.reporterPhone ? ` · ${maskPhone(incident.reporterPhone)}` : ""}
            </Field>
            <Field label="Despacho">{incident.dispatchAt ? fmtDateTime(incident.dispatchAt) : "—"}</Field>
            <Field label="Llegada a escena">{incident.arrivalAt ? fmtDateTime(incident.arrivalAt) : "—"}</Field>
            <Field label="Cierre">{incident.closedAt ? fmtDateTime(incident.closedAt) : "En atención"}</Field>
            <Field label="Duración total">{closedMs != null ? fmtDur(closedMs) : "—"}</Field>
            <div className="col-span-2">
              <Field label="Estado actual">{STATUS_META[incident.status].label}</Field>
            </div>
          </section>

          {/* Unidades intervinientes */}
          <section className="mt-5">
            <h3 className="mb-1.5 text-[11px] font-bold tracking-[0.16em] text-[#5a626b] uppercase">
              Unidades intervinientes
            </h3>
            {units.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Unidad</th>
                    <th>Despachada</th>
                    <th>Aceptó el despacho</th>
                    <th>Estado actual</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => (
                    <tr key={u.unitId}>
                      <td className="font-mono font-bold">{u.code}</td>
                      <td>{u.name}</td>
                      <td>{fmtDateTime(u.dispatchedAt)}</td>
                      <td>{u.acceptedAt ? fmtDateTime(u.acceptedAt) : "Sin confirmar"}</td>
                      <td>{UNIT_STATUS_META[u.status]?.label ?? u.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="border-t border-[#d5d9de] py-1.5 text-[12px] text-[#5a626b]">
                Sin unidades asignadas.
              </p>
            )}
          </section>

          {/* Evidencia fotográfica */}
          {incident.photoUrl && (
            <section className="mt-5">
              <h3 className="mb-1.5 text-[11px] font-bold tracking-[0.16em] text-[#5a626b] uppercase">
                Evidencia fotográfica
              </h3>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={incident.photoUrl}
                alt={`Evidencia del incidente ${code}`}
                className="max-h-64 w-full border border-[#c8ccd2] object-contain"
              />
            </section>
          )}

          {/* Hidrantes disponibles */}
          <section className="mt-5">
            <h3 className="mb-1.5 text-[11px] font-bold tracking-[0.16em] text-[#5a626b] uppercase">
              Hidrantes disponibles en la zona
            </h3>
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Distancia</th>
                  <th>Presión</th>
                  <th>Diámetro</th>
                  <th>Situación</th>
                </tr>
              </thead>
              <tbody>
                {hydrants.map((h) => (
                  <tr key={h.hydrant.id}>
                    <td className="font-mono font-bold">{hydrantLabel(h.hydrant.code)}</td>
                    <td>{fmtDistance(h.meters)}</td>
                    <td>{h.hydrant.pressure ?? "s/d"}</td>
                    <td>{h.hydrant.diameter ? `${h.hydrant.diameter} mm` : "—"}</td>
                    <td>{HYDRANT_SITUATION_META[h.hydrant.situation].label}</td>
                  </tr>
                ))}
                {hydrants.length === 0 && (
                  <tr>
                    <td colSpan={5}>Sin hidrantes registrados cerca de la escena.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {/* Notas del operador */}
          {incident.notes && (
            <section className="mt-5">
              <h3 className="mb-1.5 text-[11px] font-bold tracking-[0.16em] text-[#5a626b] uppercase">
                Notas del operador
              </h3>
              <p className="border-t border-[#d5d9de] py-1.5 text-[12.5px] whitespace-pre-wrap">
                {incident.notes}
              </p>
            </section>
          )}

          {/* Bitácora completa */}
          <section className="mt-5">
            <h3 className="mb-1.5 text-[11px] font-bold tracking-[0.16em] text-[#5a626b] uppercase">
              Bitácora del incidente
            </h3>
            <table>
              <thead>
                <tr>
                  <th className="w-32">Fecha y hora</th>
                  <th className="w-28">Actor</th>
                  <th>Registro</th>
                </tr>
              </thead>
              <tbody>
                {(incident.events ?? []).map((e) => (
                  <tr key={e.id}>
                    <td className="font-mono text-[11px]">{fmtDateTime(e.createdAt)}</td>
                    <td>{ACTOR_LABEL[e.actor] ?? e.actor}</td>
                    <td>
                      <span className="font-semibold">{EVENT_TYPE_LABEL[e.type] ?? e.type}</span>
                      {e.message ? ` — ${e.message}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Firmas */}
          <section className="mt-10 grid grid-cols-2 gap-10 text-center text-[11px] tracking-wider text-[#5a626b] uppercase">
            <div>
              <div className="mx-auto border-t border-[#111] pt-1">Jefe de guardia</div>
            </div>
            <div>
              <div className="mx-auto border-t border-[#111] pt-1">Operador de la central</div>
            </div>
          </section>

          <footer className="mt-8 border-t border-[#d5d9de] pt-2 text-[9.5px] tracking-wider text-[#8a9099] uppercase">
            Generado por B-35 · Central de Mando GIS — {fmtDateTime(new Date().toISOString())} · Documento de uso
            interno de la compañía
          </footer>
        </article>
      </div>
    </>
  );
}
