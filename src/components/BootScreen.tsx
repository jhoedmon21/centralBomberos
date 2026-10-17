import { Flame } from "@phosphor-icons/react/dist/ssr";

/** Pantalla de arranque (fallback del Suspense y primeros milisegundos) */
export default function BootScreen() {
  return (
    <div className="tac-grid flex h-dvh flex-col items-center justify-center gap-5 bg-bg">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded border border-red bg-panel">
          <Flame size={26} weight="fill" className="text-red" aria-hidden="true" />
        </span>
        <div>
          <div className="display text-3xl leading-none font-bold tracking-wide">
            FUEGO<span className="text-red">MAP</span>
          </div>
          <div className="text-xs font-semibold tracking-[0.28em] text-mu uppercase">
            Central de Mando GIS
          </div>
        </div>
      </div>
      <div className="h-1 w-56 overflow-hidden rounded bg-panel2">
        <div className="h-full w-1/3 animate-pulse rounded bg-red" />
      </div>
      <p className="text-xs tracking-widest text-mu2 uppercase">Iniciando sistemas…</p>
    </div>
  );
}
