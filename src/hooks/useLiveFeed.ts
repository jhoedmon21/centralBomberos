"use client";

import { useEffect, useRef } from "react";
import type { LiveEvent } from "@/lib/types";

interface Handlers {
  onEvent: (event: LiveEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

/** Suscripción SSE a /api/events con reconexión automática del navegador */
export function useLiveFeed({ onEvent, onOpen, onClose }: Handlers): void {
  const ref = useRef({ onEvent, onOpen, onClose });
  // Mantener los handlers frescos tras cada commit (sin re-suscribir el SSE).
  useEffect(() => {
    ref.current = { onEvent, onOpen, onClose };
  });

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onopen = () => ref.current.onOpen?.();
    es.onerror = () => ref.current.onClose?.();
    es.onmessage = (msg) => {
      try {
        ref.current.onEvent(JSON.parse(msg.data) as LiveEvent);
      } catch {
        /* mensaje no JSON */
      }
    };
    return () => es.close();
  }, []);
}
