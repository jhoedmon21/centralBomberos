import { CameraSlash } from "@phosphor-icons/react/dist/ssr";

/** Foto del reporte ciudadano o marcador táctico si no hay imagen */
export default function PhotoSlot({ url, title }: { url: string | null; title: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`Foto del reporte: ${title}`}
        width={640}
        height={400}
        className="max-h-56 w-full rounded border border-line bg-panel2 object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <div
      className="tac-grid flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded border border-dashed border-line2 bg-panel2/60 text-mu2"
      role="img"
      aria-label="Sin foto adjunta"
    >
      <CameraSlash size={22} />
      <span className="text-[11px] tracking-wider uppercase">Sin foto adjunta · reporte de texto</span>
    </div>
  );
}
