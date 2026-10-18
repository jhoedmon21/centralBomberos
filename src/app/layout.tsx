import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import ThemedToaster from "@/components/ThemedToaster";
import "./globals.css";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow-cond",
  display: "swap",
});

export const metadata: Metadata = {
  title: "B-35 Camaná · Central de Mando GIS",
  description:
    "Central de mando de la Compañía de Bomberos B-35 Camaná: reportes ciudadanos por WhatsApp, despacho de unidades y mapa táctico en tiempo real.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0e13" },
    { media: "(prefers-color-scheme: light)", color: "#edf1f5" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Aplica el tema guardado antes del primer pintado (evita destello)
const themeScript = `try{var t=localStorage.getItem("fw-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}else{document.documentElement.setAttribute("data-theme","light")}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      data-theme="light"
      suppressHydrationWarning
      className={`${barlow.variable} ${barlowCondensed.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a
          href="#fw-main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[2000] focus:rounded focus:border focus:border-line2 focus:bg-panel focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-tx"
        >
          Saltar al contenido
        </a>
        <h1 className="sr-only">B-35 Camaná · Central de Mando GIS</h1>
        {children}
        <ThemedToaster />
      </body>
    </html>
  );
}
