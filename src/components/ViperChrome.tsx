"use client";

// ============================================================
//  Cromo de cabina B-35 de la CAD central — mismas señales que la
//  tablet del chofer pero con TODA la funcionalidad real del CAD:
//   · Rail superior: marca, en vivo, unidades y píldoras rápidas
//   · Cajón (drawer): TODOS los módulos + diagnóstico del turno
//   · Tarjeta derecha: Vehículos en servicio (datos vivos)
//   · Franja de incidente + reloj de servicio
// ============================================================

import Link from "next/link";
import {
  ChartBar,
  Drop,
  Fire,
  GearSix,
  Key,
  ListBullets,
  ChatCircle,
  Plus,
  Scroll,
  SignOut,
  Siren,
  Bell,
  BellSlash,
  Broadcast,
  Clock,
  Truck,
  Users,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react";
import { useClock } from "@/hooks/useClock";
import { STATUS_META } from "@/lib/meta";
import { pad, timeAgo } from "@/lib/utils";
import type {
  IncidentDTO,
  OperatorDTO,
  StatsDTO,
  UnitDTO,
  UnitStatus,
} from "@/lib/types";

export const CLAVE_BY_STATUS: Record<UnitStatus, string> = {
  disponible: "6-0",
  en_ruta: "6-8",
  en_escena: "6-10",
  regresando: "6-9",
  fuera_servicio: "F/S",
};

const STATUS_COLOR: Record<UnitStatus, string> = {
  disponible: "var(--green)",
  en_ruta: "var(--amber)",
  en_escena: "var(--st-escena)",
  regresando: "var(--amber)",
  fuera_servicio: "var(--mu-2)",
};

export { STATUS_COLOR };

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5 leading-none select-none">
      <span className={`display font-bold tracking-wide ${compact ? "text-[15px]" : "text-[19px]"}`}>
        B<span className="text-red">-35</span>
      </span>
      {!compact && (
        <span className="cad-brand-sub text-[9px] font-bold tracking-[0.2em] text-mu2 uppercase">Central de mando</span>
      )}
    </span>
  );
}

/* ---------- RAIL superior (píldoras sobre el mapa) ---------- */

export interface ViperRailProps {
  op: OperatorDTO;
  live: boolean;
  soundOn: boolean;
  simBusy: boolean;
  units: UnitDTO[];
  unreadChat: number;
  onToggleDrawer: () => void;
  onToggleSound: () => void;
  onSimulate: () => void;
  onNewReport: () => void;
  onOpenHydrants: () => void;
  onOpenChat: () => void;
  /** Mesa de control del parque: alta/baja/modificar + estado por unidad */
  onOpenUnits: () => void;
}

export function ViperRail({
  op,
  live,
  soundOn,
  simBusy,
  units,
  unreadChat,
  onToggleDrawer,
  onToggleSound,
  onSimulate,
  onNewReport,
  onOpenHydrants,
  onOpenChat,
  onOpenUnits,
}: ViperRailProps) {
  const libres = units.filter((u) => u.status === "disponible").length;
  /* SIN CINTA: botones sueltos sobre el mapa (mismo lenguaje que la tablet).
     El header completo es pointer-events-none y cada botón reactiva su zona —
     el mapa sigue paneándose entre medias. */
  return (
    <header className="absolute inset-0 z-20 pointer-events-none" aria-label="Cabina B-35">
      {/* Marca + cajón — botón flotante arriba a la izquierda */}
      <div className="absolute left-2 top-2 flex items-center">
        <button
          type="button"
          onClick={onToggleDrawer}
          className="pointer-events-auto flex shrink-0 items-center gap-2 rounded-lg border border-line bg-panel/90 px-2 py-1.5 shadow-md backdrop-blur hover:bg-panel2/80"
          title="Abrir el cajón de módulos"
          aria-label="Abrir cajón"
        >
          <Siren size={17} weight="fill" className="text-red" aria-hidden="true" />
          <Brand />
        </button>
      </div>

      {/* En vivo + reloj — botones flotantes arriba a la derecha */}
      <div className="absolute right-2 top-2 flex items-center gap-1.5">
        <div
          className={`pointer-events-auto flex shrink-0 items-center gap-1.5 rounded-lg border bg-panel/90 px-2 py-1 shadow-md backdrop-blur ${
            live ? "border-green/35" : "border-amber/45"
          }`}
          role="status"
          title={live ? "Datos en tiempo real activos" : "Reconectando"}
        >
          <Broadcast size={12} className={live ? "text-green" : "text-amber anim-blink"} aria-hidden="true" />
          <span
            className={`text-[9px] font-bold tracking-widest uppercase ${live ? "text-green" : "text-amber"}`}
          >
            {live ? "En vivo" : "Reconectando"}
          </span>
        </div>
        <span className="pointer-events-auto inline-flex rounded-lg shadow-md">
          <ViperClock />
        </span>
      </div>

      {/* Acciones rápidas — fila de botones sueltos bajo la marca */}
      <div className="absolute left-2 top-[3.4rem] flex max-w-[calc(100vw-1rem)] flex-wrap items-center gap-1.5">
      <button type="button" className="btn btn-sm btn-red pointer-events-auto shadow-md" onClick={onOpenHydrants} title="Directorio de hidrantes (grifos)">
        <Drop size={14} aria-hidden="true" /> <span className="hidden sm:inline">Grifos</span>
      </button>
      {/* NUEVO — el botón que no se puede pasar por alto */}
      <button
        type="button"
        className="anim-pulse-ring pointer-events-auto relative flex shrink-0 items-center gap-1.5 rounded-lg bg-red px-3.5 py-2 text-[12.5px] font-bold text-white shadow-md transition-transform hover:scale-[1.04]"
        onClick={onNewReport}
        title="Registrar un reporte manual"
      >
        <Plus size={15} weight="bold" aria-hidden="true" /> Nuevo
      </button>
      {/* UNIDADES — vínculo a la mesa de control del parque */}
      <button
        type="button"
        className="btn btn-sm pointer-events-auto shadow-md"
        onClick={onOpenUnits}
        title="Unidades: agregar, quitar, modificar y ver el estado de cada una"
      >
        <Truck size={14} aria-hidden="true" />
        <span className="hidden sm:inline">Unidades</span>
        <span className="rounded-full bg-green/15 px-1.5 font-mono text-[9.5px] font-bold text-green">
          {libres}/{units.length}
        </span>
      </button>
      <button type="button" className="btn btn-sm pointer-events-auto shadow-md" onClick={onSimulate} disabled={simBusy} title="Simular reporte por WhatsApp">
        <WhatsappLogo size={14} weight="fill" className="text-green" aria-hidden="true" />
        <span className="hidden md:inline">{simBusy ? "Recibiendo…" : "Simular"}</span>
      </button>
      <Link href="/reportes" className="btn btn-sm pointer-events-auto shadow-md" title="Informe de tiempos de respuesta (P50/P90)">
        <ChartBar size={14} aria-hidden="true" /> <span className="hidden md:inline">Informe</span>
      </Link>
      <button
        type="button"
        className="btn btn-sm pointer-events-auto relative shadow-md"
        onClick={onOpenChat}
        title="Chat con las unidades"
        aria-label={unreadChat > 0 ? `Chat con unidades: ${unreadChat} sin leer` : "Chat con unidades"}
      >
        <ChatCircle size={14} aria-hidden="true" />
        <span className="hidden md:inline">Chat</span>
        {unreadChat > 0 && (
          <span
            className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-amber px-0.5 text-[8.5px] font-bold text-black"
            aria-hidden="true"
          >
            {unreadChat > 9 ? "9+" : unreadChat}
          </span>
        )}
      </button>
      <button
        type="button"
        className="btn btn-sm pointer-events-auto shadow-md"
        onClick={onToggleSound}
        title={soundOn ? "Alertas sonoras activadas" : "Alertas silenciadas"}
        aria-label={soundOn ? "Silenciar alertas" : "Activar alertas sonoras"}
      >
        {soundOn ? <Bell size={14} className="text-amber" aria-hidden="true" /> : <BellSlash size={14} className="text-mu" aria-hidden="true" />}
      </button>
      <span className="hidden shrink-0 items-center pl-1 text-[10px] leading-none text-mu2 xl:flex" title={`Sesión: ${op.email}`}>
        {op.name}
      </span>
      </div>
    </header>
  );
}

/* ---------- CAJÓN con todos los módulos ---------- */

export interface ViperDrawerProps {
  op: OperatorDTO;
  theme: "dark" | "light";
  soundOn: boolean;
  live: boolean;
  stats: StatsDTO;
  simBusy: boolean;
  onClose: () => void;
  onToggleSound: () => void;
  onSimulate: () => void;
  onNewReport: () => void;
  onOpenHydrants: () => void;
  onOpenChat: () => void;
  onOpenUsers: () => void;
  onOpenAudit: () => void;
  onOpenMiClave: () => void;
  onOpenSettings: () => void;
  /** Abre el panel flotante de REPORTES (la «tabla» live de la CAD) */
  onOpenQueue: () => void;
  onLogout: () => void;
}

function MenuItem({
  icon,
  label,
  onClick,
  tone = "normal",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "normal" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13.5px] font-semibold transition-[background-color,transform] hover:translate-x-0.5 hover:bg-panel2/80 ${
        tone === "danger" ? "text-red" : "text-tx"
      }`}
    >
      <span className="shrink-0 text-mu">{icon}</span>
      {label}
    </button>
  );
}

export function ViperDrawer(props: ViperDrawerProps) {
  const { op, soundOn, live, stats, simBusy, onClose } = props;
  const now = useClock(30_000);
  const chief = op.role === "jefe";

  return (
    <div
      className="pointer-events-auto absolute left-2 top-14 bottom-2 z-40 flex w-[300px] max-w-[84vw] flex-col overflow-hidden rounded-xl border border-line bg-panel/95 shadow-2xl backdrop-blur"
      role="dialog"
      aria-label="Cajón de módulos B-35"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <Brand />
        <button type="button" onClick={onClose} className="btn btn-sm px-2 py-1" aria-label="Cerrar cajón">
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="px-4 pt-3">
        <p className="text-[11px] text-mu2">
          Central de Mando GIS · Camaná, PE
        </p>
        <p className="text-[12.5px] font-bold">{op.name} · {op.role === "jefe" ? "Jefe" : op.role === "operador" ? "Operador" : "Lectura"}</p>
      </div>

      <nav className="dialog-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-label="Módulos del CAD">
        <MenuItem icon={<WhatsappLogo size={17} className="text-green" />} label="Simular reporte" onClick={props.onSimulate} />
        <MenuItem icon={<Plus size={17} />} label="Nuevo reporte" onClick={props.onNewReport} />
        <MenuItem icon={<Drop size={17} className="text-blue" />} label="Grifos / hidrantes" onClick={props.onOpenHydrants} />
        <MenuItem icon={<ListBullets size={17} />} label="Reportes (lista viva)" onClick={props.onOpenQueue} />
        <MenuItem icon={<ChatCircle size={17} className="text-blue" />} label="Chat con unidades" onClick={props.onOpenChat} />
        <MenuItem icon={<GearSix size={17} />} label="Preferencias de la central" onClick={props.onOpenSettings} />
        <MenuItem icon={<Key size={17} />} label="Mi clave" onClick={props.onOpenMiClave} />
        {chief && <MenuItem icon={<Users size={17} />} label="Operadores" onClick={props.onOpenUsers} />}
        {chief && <MenuItem icon={<Scroll size={17} />} label="Historial de comunicaciones" onClick={props.onOpenAudit} />}
        <MenuItem
          icon={soundOn ? <Bell size={17} className="text-amber" /> : <BellSlash size={17} />}
          label={soundOn ? "Silenciar alertas" : "Activar alertas"}
          onClick={props.onToggleSound}
        />
        <MenuItem icon={<SignOut size={17} />} label="Cerrar sesión" onClick={props.onLogout} tone="danger" />
      </nav>

      {/* Diagnóstico del turno (lo que antes era la tira de indicadores) */}
      <div className="border-t border-line px-4 py-3">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-mu2 uppercase">
          <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-green" : "bg-amber anim-blink"}`} aria-hidden="true" />
          {live ? "Sincronización activa" : "Reconectando"}
        </p>
        <div className="grid grid-cols-2 gap-1.5 text-[11.5px]">
          <div className="rounded border border-line bg-panel2 px-2 py-1.5">
            <span className="block text-[9px] tracking-widest text-mu2 uppercase">Activos</span>
            <span className="display text-base font-bold" style={{ color: "var(--red)" }}>{stats.activos}</span>
          </div>
          <div className="rounded border border-line bg-panel2 px-2 py-1.5">
            <span className="block text-[9px] tracking-widest text-mu2 uppercase">Unidades libres</span>
            <span className="display text-base font-bold" style={{ color: "var(--green)" }}>
              {stats.unidadesDisponibles}/{stats.unidadesTotal}
            </span>
          </div>
          <div className="rounded border border-line bg-panel2 px-2 py-1.5">
            <span className="block text-[9px] tracking-widest text-mu2 uppercase">Reportes hoy</span>
            <span className="display text-base font-bold">{stats.hoy}</span>
          </div>
          <div className="rounded border border-line bg-panel2 px-2 py-1.5">
            <span className="block text-[9px] tracking-widest text-mu2 uppercase">Resp. promedio</span>
            <span className="display text-base font-bold">
              {stats.respuestaPromedioMin !== null ? `${stats.respuestaPromedioMin}′` : "—"}
            </span>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-mu2">
          Última actualización{" "}
          {now
            ? `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`
            : "—"}
        </p>
      </div>
    </div>
  );
}

/* ---------- FRANJA de incidente + RELOJ (pie de cabina) ---------- */

/* La lista de vehículos vive SOLO en el rail (dots + code + clave): no hay
   tarjeta repetida a la derecha — menos información duplicada en pantalla. */

export interface ViperStripProps {
  incident: IncidentDTO | null;
  onOpenDetail: () => void;
}

export function ViperStrip({ incident, onOpenDetail }: ViperStripProps) {
  if (!incident) {
    return (
      <div className="pointer-events-auto absolute bottom-16 left-1/2 z-10 -translate-x-1/2 lg:bottom-2" role="status">
        <div className="map-panel flex items-center gap-2 rounded-full px-4 py-2 text-[12px] text-mu">
          <Fire size={14} className="text-green" aria-hidden="true" /> Sin emergencias en pantalla
        </div>
      </div>
    );
  }
  const when = new Date(incident.createdAt);
  return (
    <div className="pointer-events-auto absolute bottom-16 left-1/2 z-10 w-[min(92vw,540px)] -translate-x-1/2 lg:bottom-2" role="status">
      <div className="map-panel flex items-center gap-3 rounded-xl p-2.5 pr-4">
        <button
          type="button"
          onClick={onOpenDetail}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red text-white shadow-[0_0_16px_-4px_var(--red)]"
          title="Abrir el detalle flotante"
          aria-label="Abrir detalle del incidente"
        >
          <Siren size={20} weight="fill" aria-hidden="true" />
        </button>
        <button type="button" onClick={onOpenDetail} className="min-w-0 flex-1 text-left">
          <p className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold tracking-wider text-mu uppercase">
            <span>
              {when ? `${pad(when.getDate())}-${pad(when.getMonth() + 1)}-${when.getFullYear()} · ${pad(when.getHours())}:${pad(when.getMinutes())}:${pad(when.getSeconds())}` : ""}
            </span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase"
              style={{
                color: `var(${STATUS_META[incident.status].varName})`,
                background: `color-mix(in srgb, var(${STATUS_META[incident.status].varName}) 18%, transparent)`,
              }}
            >
              {STATUS_META[incident.status].label}
            </span>
            <span className="text-mu2">·</span>
            <span className="truncate">{timeAgo(incident.createdAt)}</span>
          </p>
          <p className="truncate text-[14.5px] font-bold leading-tight">{incident.title}</p>
          <p className="truncate text-[11px] text-mu">
            {incident.address}
            {incident.notes ? ` — ${incident.notes}` : ""}
          </p>
        </button>
      </div>
    </div>
  );
}

/* ---------- RELOJ del servicio (chip del rail) ---------- */

export function ViperClock() {
  const now = useClock();
  if (!now) return <div aria-hidden="true" className="h-2 w-2 shrink-0" />;
  const dias = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
  const meses = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SET", "OCT", "NOV", "DIC"];
  return (
    <div
      className="flex shrink-0 items-center gap-1.5 rounded border border-line bg-panel2/60 px-2 py-1"
      role="timer"
      title="Hora y fecha del servicio"
    >
      <Clock size={12} className="text-mu" aria-hidden="true" />
      <strong className="display text-[13.5px] font-bold leading-none tabular-nums text-tx">
        {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
      </strong>
      <span className="cad-clock-date text-[9px] font-bold tracking-wider text-mu2">
        {dias[now.getDay()]} {pad(now.getDate())}/{meses[now.getMonth()]}
      </span>
    </div>
  );
}
