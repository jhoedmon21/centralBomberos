"use client";

// Ventanas de la central movibles por su cabecera — un solo comportamiento
// para TODOS los diálogos (antes solo lo tenían «Nuevo reporte» e «Hidrante»,
// cada uno con su copia). La posición queda fijada al arrastrar y limitada
// al viewport; al cerrar la ventana (desmontar) vuelve a su centro.

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

export function useDraggablePanel(panelRef: RefObject<HTMLElement | null>) {
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragState = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Cierre de la ventana: el estado muere con el componente
  useEffect(() => () => { dragState.current = null; }, []);

  const startDrag = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      // No arrastrar desde controles interactivos de la cabecera
      if ((e.target as HTMLElement).closest("button, a, input, select, textarea, [data-no-drag]")) return;
      const panel = panelRef.current;
      if (!panel) return;
      const r = panel.getBoundingClientRect();
      // w/h fijan el tamaño actual dentro de dragPos: al pasar a
      // position:fixed ningún panel colapsa (el chat usa anclas
      // top/bottom del mapa y perdería la altura).
      dragState.current = { px: e.clientX, py: e.clientY, ox: r.left, oy: r.top };
      setDragPos({ x: r.left, y: r.top, w: r.width, h: r.height });
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [panelRef],
  );

  const moveDrag = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const d = dragState.current;
      const panel = panelRef.current;
      if (!d || !panel) return;
      const margin = 8;
      const maxX = Math.max(margin, window.innerWidth - panel.offsetWidth - margin);
      const maxY = Math.max(margin, window.innerHeight - panel.offsetHeight - margin);
      setDragPos((prev) =>
        prev
          ? {
              ...prev,
              x: Math.min(Math.max(e.clientX - d.px + d.ox, margin), maxX),
              y: Math.min(Math.max(e.clientY - d.py + d.oy, margin), maxY),
            }
          : null,
      );
    },
    [panelRef],
  );

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!dragState.current) return;
      dragState.current = null;
      setDragging(false);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [],
  );

  /** Vuelve a centrar la ventana (quita la posición fijada) */
  const reset = useCallback(() => {
    dragState.current = null;
    setDragging(false);
    setDragPos(null);
  }, []);

  /** Estilo del panel: centrado por el overlay hasta el primer arrastre;
   *  al arrastrar fija también su tamaño (evita saltos de layout) */
  const panelStyle = dragPos
    ? {
        position: "fixed" as const,
        left: dragPos.x,
        top: dragPos.y,
        margin: 0,
        width: dragPos.w,
        height: dragPos.h,
      }
    : undefined;

  /** Propiedades de la cabecera-asas del panel */
  const handleProps = {
    onPointerDown: startDrag,
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };

  return { dragging, panelStyle, handleProps, reset };
}
