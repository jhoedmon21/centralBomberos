"use client";

import {
  Bell,
  BellSlash,
  Broadcast,
  Drop,
  Flame,
  GearSix,
  Moon,
  Plus,
  Sun,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { useClock } from "@/hooks/useClock";
import { pad } from "@/lib/utils";

interface Props {
  live: boolean;
  soundOn: boolean;
  simBusy: boolean;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onToggleSound: () => void;
  onSimulate: () => void;
  onNewReport: () => void;
  onOpenSettings: () => void;
  onOpenHydrants: () => void;
}

export default function TopBar({
  live,
  soundOn,
  simBusy,
  theme,
  onToggleTheme,
  onToggleSound,
  onSimulate,
  onNewReport,
  onOpenSettings,
  onOpenHydrants,
}: Props) {
  const now = useClock();

  return (
    <header className="chrome-top flex h-12 shrink-0 items-center gap-3 border-b border-line px-3">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded border border-red/60 bg-panel2 shadow-[0_0_18px_-6px_var(--red)]">
          <Flame size={17} weight="fill" className="text-red" aria-hidden="true" />
        </span>
        <div className="leading-none">
          <div className="display text-lg font-bold tracking-wide">
            B<span className="text-red">-35</span>
          </div>
          <div className="hidden text-[9px] font-semibold tracking-[0.22em] text-mu uppercase sm:block">
            Central de Mando GIS
          </div>
        </div>
      </div>

      {/* Estado del flujo en vivo */}
      <div
        className={`ml-1 flex items-center gap-1.5 rounded border px-2 py-1 ${
          live ? "border-green/35 bg-green/10" : "border-amber/45 bg-amber/10"
        }`}
        role="status"
        aria-label={live ? "Conectado en vivo" : "Reconectando"}
        title={live ? "Datos en tiempo real activos" : "Sin conexión en vivo: reintentando"}
      >
        <Broadcast size={13} className={live ? "text-green" : "text-amber"} aria-hidden="true" />
        <span
          className={`text-[10px] font-bold tracking-widest uppercase ${live ? "text-green" : "text-amber anim-blink"}`}
        >
          {live ? "En vivo" : "Reconectando"}
        </span>
      </div>

      <div className="flex-1" />

      {/* Reloj */}
      <div className="hidden items-center gap-2 md:flex" aria-hidden="true">
        <span className="font-mono text-sm font-semibold tracking-wider text-tx">
          {now ? `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` : "--:--:--"}
        </span>
        <span className="text-[10px] tracking-widest text-mu2 uppercase">
          {now
            ? now.toLocaleDateString("es-PE", { day: "2-digit", month: "short" }).toUpperCase()
            : ""}
        </span>
      </div>

      <div className="mx-1 hidden h-6 w-px bg-line md:block" />

      {/* Acciones */}
      <button
        className="btn btn-sm"
        onClick={onToggleTheme}
        aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
        title={theme === "dark" ? "Tema claro" : "Tema oscuro"}
      >
        {theme === "dark" ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
      </button>
      <button
        className="btn btn-sm"
        onClick={onToggleSound}
        aria-label={soundOn ? "Silenciar alertas" : "Activar alertas sonoras"}
        title={soundOn ? "Alertas sonoras activadas" : "Alertas silenciadas"}
      >
        {soundOn ? (
          <Bell size={15} className="text-amber" aria-hidden="true" />
        ) : (
          <BellSlash size={15} className="text-mu" aria-hidden="true" />
        )}
      </button>
      <button
        className="btn btn-sm"
        onClick={onOpenHydrants}
        aria-label="Directorio de hidrantes"
        title="Directorio de hidrantes de la zona"
      >
        <Drop size={15} aria-hidden="true" />
        <span className="hidden lg:inline">Hidrantes</span>
      </button>
      <button
        className="btn btn-sm"
        onClick={onOpenSettings}
        aria-label="Configuración de la central"
        title="Configuración de la central"
      >
        <GearSix size={15} aria-hidden="true" />
        <span className="hidden xl:inline">Configuración</span>
      </button>
      <button
        className="btn btn-sm"
        onClick={onSimulate}
        disabled={simBusy}
        aria-label={simBusy ? "Recibiendo reporte" : "Simular reporte por WhatsApp"}
        title="Simula un reporte ciudadano por WhatsApp (modo demo)"
      >
        <WhatsappLogo size={15} weight="fill" className="text-green" aria-hidden="true" />
        <span className="hidden md:inline">{simBusy ? "Recibiendo…" : "Simular reporte"}</span>
      </button>
      <button
        className="btn btn-sm btn-red"
        onClick={onNewReport}
        aria-label="Registrar un reporte manual"
        title="Registrar un reporte manual"
      >
        <Plus size={15} weight="bold" aria-hidden="true" />
        <span className="hidden sm:inline">Nuevo reporte</span>
      </button>
    </header>
  );
}
