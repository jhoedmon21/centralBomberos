"use client";

// Barra superior del informe: imprimir/guardar PDF y cerrar. No sale en papel.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Printer, X } from "@phosphor-icons/react";

export default function PrintBar({ code }: { code: string }) {
  const router = useRouter();

  // El título del documento sugiere el nombre del PDF al guardarlo
  useEffect(() => {
    const prev = document.title;
    document.title = `Parte ${code} · B-35`;
    return () => {
      document.title = prev;
    };
  }, [code]);

  function cerrar() {
    window.close(); // funciona si la pestaña la abrió la central
    // Si el navegador no permitió cerrar, volver a la central
    setTimeout(() => router.push("/"), 150);
  }

  return (
    <div className="no-print sticky top-0 z-50 flex items-center justify-between gap-2 border-b border-line bg-panel px-4 py-2.5 print:hidden">
      <span className="text-[12px] font-semibold text-mu">
        Parte de emergencia <span className="font-mono">{code}</span>
      </span>
      <div className="flex gap-2">
        <button className="btn btn-red" onClick={() => window.print()}>
          <Printer size={15} aria-hidden="true" /> Imprimir / Guardar PDF
        </button>
        <button className="btn" onClick={cerrar}>
          <X size={15} aria-hidden="true" /> Cerrar
        </button>
      </div>
    </div>
  );
}
