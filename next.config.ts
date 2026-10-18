import type { NextConfig } from "next";

// URL del deployment de la PWA de tablet (proyecto Vercel aparte, mismo repo).
// La central la sirve bajo /app/ (rewrite): MISMO ORIGEN → cookies httpOnly,
// SSE y fetch de la tablet funcionan sin CORS ni cookies de terceros.
const TABLET_APP_URL = process.env.TABLET_APP_URL; // p. ej. https://fuegomap-tablet.vercel.app

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  ...(TABLET_APP_URL
    ? {
        async rewrites() {
          return [
            { source: "/app", destination: `${TABLET_APP_URL}/` },
            { source: "/app/:path*", destination: `${TABLET_APP_URL}/:path*` },
          ];
        },
      }
    : {}),
  // Next dev bloquea los recursos de desarrollo (HMR, chunks dinámicos como el
  // mapa) cuando se accede por orígenes distintos a "localhost". Se permiten
  // aquí las direcciones locales y de red para desarrollo (sin esquema ni puerto).
  allowedDevOrigins: ["127.0.0.1", "192.168.1.17"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
