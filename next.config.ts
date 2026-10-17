import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
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
