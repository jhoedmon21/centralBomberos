"use client";

// Botón de impresión del informe: imprime SOLO el reporte (los botones y
// vínculos llevan .no-print y se ocultan en el CSS de impresión).

import { Printer } from "@phosphor-icons/react";

export default function PrintButton() {
  return (
    <button
      className="btn btn-sm btn-red"
      onClick={() => window.print()}
      title="Imprimir o guardar como PDF"
    >
      <Printer size={15} aria-hidden="true" /> Imprimir
    </button>
  );
}
