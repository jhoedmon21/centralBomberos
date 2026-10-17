"use client";

import { useEffect, useState } from "react";

/** Reloj de la central: null hasta montar en el cliente (evita desajustes SSR) */
export function useClock(intervalMs = 1000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    // Primer cálculo diferido: evita setState síncrono dentro del efecto.
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [intervalMs]);
  return now;
}
