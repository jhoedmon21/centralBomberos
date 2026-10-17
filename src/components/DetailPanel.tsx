"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Bell,
  CheckCircle,
  Drop,
  FilePdf,
  Fire,
  MapPin,
  NavigationArrow,
  PencilSimple,
  Phone,
  PlusCircle,
  Truck,
  User,
  WhatsappLogo,
  XCircle,
} from "@phosphor-icons/react";
import { nearestHydrants } from "@/lib/geo";
import { SEVERITY_META, SOURCE_META, STATUS_META } from "@/lib/meta";
import type {
  ActivityDTO,
  HydrantDTO,
  IncidentDTO,
  IncidentStatus,
  UnitDTO,
  UnitStatus,
} from "@/lib/types";
import { cx, displayCode, fmtCoords, fmtDateTime, fmtDistance, maskPhone } from "@/lib/utils";
import ActivityFeed from "./ActivityFeed";
import Timeline from "./Timeline";
import UnitsBoard from "./UnitsBoard";

const HydrantMiniMap = dynamic(() => import("./HydrantMiniMap"), {
  ssr: false,
  loading: () => <div className="h-40 w-full animate-pulse rounded border border-line bg-panel2" />,
});

export type DetailTab = "detalle" | "unidades" | "actividad";

interface Props {
  incident: IncidentDTO | null;
  fallback: IncidentDTO | null;
  busy: boolean;
  tab: DetailTab;
  theme: "dark" | "light";
  onTabChange: (t: DetailTab) => void;
  hydrants: HydrantDTO[];
  units: UnitDTO[];
  activity: ActivityDTO[];
  waCentralConfigured: boolean;
  onDispatch: (i: IncidentDTO) => void;
  onStatus: (i: IncidentDTO, s: IncidentStatus) => void;
  onReply: (i: IncidentDTO) => void;
  onNotifyCentral: (i: IncidentDTO) => void;
  onEdit: (i: IncidentDTO) => void;
  onSelectIncident: (id: number) => void;
  onSetUnitStatus: (id: number, s: UnitStatus) => void;
  onUnitsChanged: () => void;
  onAddUnit: () => void;
  onRemoveUnit: (id: number) => Promise<void>;
  /** Cambiar la dotación (efectivos) de una unidad */
  onSetCrew: (id: number, crew: number) => Promise<void>;
  /** Incidente con la ruta trazada en el mapa (null = sin ruta) */
  routeForId: number | null;
  /** Trazar/quitar la ruta vial en el mapa de la central */
  onRoute: (i: IncidentDTO) => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_1fr] items-start gap-2">
      <dt className="text-[10.5px] font-bold tracking-wider text-mu2 uppercase">{label}</dt>
      <dd className="text-[12.5px] leading-snug break-words">{children}</dd>
    </div>
  );
}

/** Panel derecho: detalle del incidente, unidades y bitácora global */
export default function DetailPanel({
  incident,
  fallback,
  busy,
  tab,
  theme,
  onTabChange,
  hydrants,
  units,
  activity,
  waCentralConfigured,
  onDispatch,
  onStatus,
  onReply,
  onNotifyCentral,
  onEdit,
  onSelectIncident,
  onSetUnitStatus,
  onUnitsChanged,
  onAddUnit,
  onRemoveUnit,
  onSetCrew,
  routeForId,
  onRoute,
}: Props) {
  const shown = incident ?? fallback;
  // Confirmación de dos pasos: se "arma" contra la clave del incidente
  // visible, así se desarma sola al cambiar de incidente o de estado.
  const [armedFor, setArmedFor] = useState<string | null>(null);
  const targetKey = shown ? `${shown.id}:${shown.status}` : null;
  const confirming = armedFor !== null && armedFor === targetKey;

  useEffect(() => {
    if (armedFor === null) return;
    const t = setTimeout(() => setArmedFor(null), 3500);
    return () => clearTimeout(t);
  }, [armedFor]);

  const nearHydrants = useMemo(
    () => (shown ? nearestHydrants(shown.lat, shown.lng, hydrants, 3) : []),
    [shown, hydrants],
  );

  const availableUnits = units.filter((u) => u.status === "disponible").length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      {/* Pestañas */}
      <div
        className="flex shrink-0 border-b border-line"
        role="tablist"
        aria-label="Secciones del incidente"
        onKeyDown={(e) => {
          const order: DetailTab[] = ["detalle", "unidades", "actividad"];
          const idx = order.indexOf(tab);
          let next = -1;
          if (e.key === "ArrowRight") next = (idx + 1) % order.length;
          else if (e.key === "ArrowLeft") next = (idx - 1 + order.length) % order.length;
          else if (e.key === "Home") next = 0;
          else if (e.key === "End") next = order.length - 1;
          if (next < 0) return;
          e.preventDefault();
          const key = order[next];
          onTabChange(key);
          document.getElementById(`tab-${key}`)?.focus();
        }}
      >
        {(
          [
            ["detalle", "Detalle"],
            ["unidades", `Unidades · ${availableUnits}`],
            ["actividad", "Actividad"],
          ] as [DetailTab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            id={`tab-${key}`}
            role="tab"
            aria-selected={tab === key}
            aria-controls="fw-detail-panel"
            tabIndex={tab === key ? 0 : -1}
            className={cx(
              "flex-1 border-b-2 px-2 py-2.5 text-[11.5px] font-bold tracking-wider uppercase transition-colors",
              tab === key ? "border-red text-tx" : "border-transparent text-mu hover:text-tx",
            )}
            onClick={() => onTabChange(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div
        id="fw-detail-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {tab === "unidades" && (
          <UnitsBoard
            units={units}
            incidents={incident ? [incident] : fallback ? [fallback] : []}
            onSelectIncident={onSelectIncident}
            onSetStatus={onSetUnitStatus}
            onUnitsChanged={onUnitsChanged}
            onAddUnit={onAddUnit}
            onRemoveUnit={onRemoveUnit}
            onSetCrew={onSetCrew}
          />
        )}

        {tab === "actividad" && <ActivityFeed activity={activity} onSelectIncident={onSelectIncident} />}

        {tab === "detalle" &&
          (!shown ? (
            <div className="grid h-full place-items-center p-6 text-center">
              <div>
                <Fire size={26} className="mx-auto text-mu2" aria-hidden="true" />
                <p className="mt-2 text-[13px] text-mu">
                  Selecciona un incidente en la cola o en el mapa para ver su detalle táctico.
                </p>
              </div>
            </div>
          ) : (
            <div aria-busy={busy} className={cx(busy && "opacity-60")}>
              {/* Encabezado */}
              <header className="border-b border-line px-3 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="chip" style={{ color: `var(${STATUS_META[shown.status].varName})` }}>
                    {STATUS_META[shown.status].label}
                  </span>
                  <span className="chip" style={{ color: `var(${SEVERITY_META[shown.severity].varName})` }}>
                    Sev. {SEVERITY_META[shown.severity].label}
                  </span>
                  <span className="chip text-mu" style={{ color: "var(--mu)" }}>
                    {SOURCE_META[shown.source].label}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-mu2">
                    {displayCode(shown.id, shown.createdAt)}
                  </span>
                </div>
                <h2 className="display mt-2 text-xl leading-tight font-bold">{shown.title}</h2>
                <p className="mt-1 flex items-start gap-1.5 text-[12.5px] text-mu">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-red" aria-hidden="true" />
                  {shown.address}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-mu2" suppressHydrationWarning>
                  Reportado {fmtDateTime(shown.createdAt)} · {fmtCoords(shown.lat, shown.lng)}
                </p>
              </header>

              {/* Foto + datos */}
              <section className="space-y-3 border-b border-line px-3 py-3">
                <dt className="text-[10.5px] font-bold tracking-wider text-mu2 uppercase">Evidencia</dt>
                {shown.photoUrl ? (
                  <a
                    href={shown.photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Abrir evidencia en tamaño completo"
                    className="block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={shown.photoUrl}
                      alt={`Foto del reporte: ${shown.title}`}
                      width={640}
                      height={400}
                      className="max-h-52 w-full rounded border border-line object-cover"
                    />
                  </a>
                ) : (
                  <div className="tac-grid flex h-24 flex-col items-center justify-center gap-1 rounded border border-dashed border-line2 bg-panel2/50 text-mu2">
                    <MapPin size={18} aria-hidden="true" />
                    <span className="text-[10.5px] tracking-wider uppercase">Sin foto · reporte georreferenciado</span>
                  </div>
                )}

                <dl className="space-y-2 pt-1">
                  <Row label="Reportante">
                    <span className="flex items-center gap-1.5">
                      <User size={13} className="text-mu2" aria-hidden="true" />
                      {shown.reporterName ?? "No indicado"}
                    </span>
                  </Row>
                  <Row label="Contacto">
                    <span className="flex items-center gap-1.5">
                      <Phone size={13} className="text-mu2" aria-hidden="true" />
                      {shown.reporterPhone ? maskPhone(shown.reporterPhone) : "—"}
                    </span>
                  </Row>
                  <Row label="Unidad">
                    {shown.unit ? (
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Truck size={14} className="text-blue" aria-hidden="true" />
                        {shown.unit.code} — {shown.unit.name}
                        <span className="text-[11px] font-normal text-mu">
                          ({shown.unit.station ?? "sin compañía"})
                        </span>
                      </span>
                    ) : (
                      <span className="text-mu2">Sin unidad asignada</span>
                    )}
                  </Row>
                  {/* Despacho multi-unidad: todas las asignadas + quién aceptó */}
                  {shown.units && shown.units.length > 1 && (
                    <Row label="Asignadas">
                      <span className="flex flex-wrap gap-1">
                        {shown.units.map((a) => (
                          <span
                            key={a.unitId}
                            className={cx(
                              "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10.5px] font-semibold",
                              a.acceptedAt ? "border-green/60 text-green" : "border-amber/60 text-amber",
                            )}
                            title={a.acceptedAt ? "Aceptó el despacho" : "Pendiente de aceptar"}
                          >
                            <CheckCircle size={10} weight="fill" className={a.acceptedAt ? "" : "opacity-40"} aria-hidden="true" />
                            {a.code}
                          </span>
                        ))}
                      </span>
                    </Row>
                  )}
                  {shown.dispatchAt && (
                    <Row label="Despacho">
                      <span className="font-mono text-[12px]">{fmtDateTime(shown.dispatchAt)}</span>
                    </Row>
                  )}
                  {shown.arrivalAt && shown.dispatchAt && (
                    <Row label="Llegada">
                      <span className="font-mono text-[12px]">
                        {fmtDateTime(shown.arrivalAt)}{" "}
                        <span className="text-mu2">
                          ({Math.round((+new Date(shown.arrivalAt) - +new Date(shown.dispatchAt)) / 60000)} min
                          desde despacho)
                        </span>
                      </span>
                    </Row>
                  )}
                  {shown.closedAt && (
                    <Row label="Cierre">
                      <span className="font-mono text-[12px]">{fmtDateTime(shown.closedAt)}</span>
                    </Row>
                  )}
                  {shown.notes && (
                    <Row label="Notas">
                      <span className="text-mu">{shown.notes}</span>
                    </Row>
                  )}
                </dl>
              </section>

              {/* Hidrantes cercanos */}
              <section className="border-b border-line px-3 py-3">
                <h3 className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold tracking-wider text-mu2 uppercase">
                  <Drop size={13} className="text-blue" aria-hidden="true" /> Hidrantes tácticos cercanos
                </h3>
                {nearHydrants.length > 0 && (
                  <div className="mb-2">
                    <HydrantMiniMap
                      theme={theme}
                      lat={shown.lat}
                      lng={shown.lng}
                      hydrants={nearHydrants.map((h, idx) => ({
                        n: idx + 1,
                        code: h.hydrant.code,
                        lat: h.hydrant.lat,
                        lng: h.hydrant.lng,
                        meters: h.meters,
                      }))}
                    />
                  </div>
                )}
                <ul className="space-y-1.5">
                  {nearHydrants.map((h, idx) => (
                    <li
                      key={h.hydrant.id}
                      className="flex items-center justify-between rounded border border-line bg-panel2 px-2.5 py-1.5"
                    >
                      <span className="flex items-center gap-2 text-[12.5px] font-semibold">
                        <Drop size={14} weight="fill" className="text-blue" aria-hidden="true" />
                        {h.hydrant.code ?? `Hidrante ${idx + 1}`}
                        <span className="text-[11px] font-normal text-mu capitalize">
                          presión {h.hydrant.pressure ?? "s/d"} · {h.hydrant.diameter ?? "—"} mm
                        </span>
                      </span>
                      <span className="font-mono text-[11.5px] text-blue">{fmtDistance(h.meters)}</span>
                    </li>
                  ))}
                  {!nearHydrants.length && (
                    <li className="text-[12px] text-mu2">No hay hidrantes registrados cerca de la escena.</li>
                  )}
                </ul>
              </section>

              {/* Bitácora */}
              <section className="px-3 py-3">
                <h3 className="mb-2.5 text-[10.5px] font-bold tracking-wider text-mu2 uppercase">Bitácora del incidente</h3>
                <Timeline events={incident?.events ?? []} />
              </section>
            </div>
          ))}
      </div>

      {/* Acciones */}
      {tab === "detalle" && shown && (
        <div className="shrink-0 space-y-2 border-t border-line bg-panel p-3">
          {shown.status === "reportado" && (
            <button className="btn btn-red w-full py-2.5 text-[13.5px]" onClick={() => onDispatch(shown)}>
              <Truck size={16} weight="fill" aria-hidden="true" /> Despachar unidad
            </button>
          )}
          {shown.status === "despachado" && (
            <button className="btn w-full py-2.5 text-[13.5px]" onClick={() => onStatus(shown, "en_escena")}>
              <MapPin size={16} weight="fill" className="text-blue" aria-hidden="true" /> Marcar llegada a escena
            </button>
          )}
          {shown.status === "en_escena" && (
            <button className="btn btn-green w-full py-2.5 text-[13.5px]" onClick={() => onStatus(shown, "controlado")}>
              <CheckCircle size={16} weight="fill" aria-hidden="true" /> Marcar incendio controlado
            </button>
          )}
          {/* Refuerzos: la central es la única que despacha (las tablets solo aceptan) */}
          {(shown.status === "despachado" || shown.status === "en_escena") && (
            <button className="btn w-full py-2.5 text-[13.5px]" onClick={() => onDispatch(shown)}>
              <PlusCircle size={16} weight="fill" aria-hidden="true" /> Pedir refuerzos (agregar unidades)
            </button>
          )}
          {shown.status === "controlado" && (
            <button className="btn btn-green w-full py-2.5 text-[13.5px]" onClick={() => onStatus(shown, "cerrado")}>
              <CheckCircle size={16} weight="fill" aria-hidden="true" /> Cerrar incidente
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              className="btn"
              onClick={() => onReply(shown)}
              disabled={!shown.reporterPhone}
              title={shown.reporterPhone ? "Responder por WhatsApp al ciudadano" : "Sin teléfono de contacto"}
            >
              <WhatsappLogo size={15} weight="fill" className="text-green" aria-hidden="true" /> Responder
            </button>
            <button
              className={cx("btn", routeForId === shown.id && "border-amber/60 text-amber")}
              onClick={() => onRoute(shown)}
              title={
                routeForId === shown.id
                  ? "Quitar la ruta del mapa"
                  : "Trazar la ruta vial hasta la escena en el mapa de la central"
              }
            >
              <NavigationArrow size={15} aria-hidden="true" /> {routeForId === shown.id ? "Quitar ruta" : "Ruta"}
            </button>
          </div>

          <button className="btn w-full" onClick={() => onEdit(shown)}>
            <PencilSimple size={15} aria-hidden="true" /> Editar reporte
          </button>

          <button
            className="btn w-full"
            onClick={() => window.open(`/informe/${shown.id}`, "_blank", "noopener")}
            title="Abrir el parte de emergencia: imprimir o guardar como PDF"
          >
            <FilePdf size={15} className="text-red" aria-hidden="true" /> Parte PDF (informe)
          </button>

          {(shown.status === "reportado" || shown.status === "despachado") && (
            <button
              className={cx("btn w-full", confirming ? "btn-red" : "btn-ghost")}
              onClick={() => {
                if (!confirming) {
                  setArmedFor(targetKey);
                  return;
                }
                onStatus(shown, "cerrado");
                setArmedFor(null);
              }}
            >
              <XCircle size={15} aria-hidden="true" />
              {confirming ? "¿Confirmar cierre/cancelación del reporte?" : "Cancelar reporte"}
            </button>
          )}

          {waCentralConfigured && (
            <button className="btn btn-ghost w-full" onClick={() => onNotifyCentral(shown)}>
              <Bell size={14} aria-hidden="true" /> Avisar a la central por WhatsApp
            </button>
          )}
        </div>
      )}
    </div>
  );
}
