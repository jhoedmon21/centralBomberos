import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Archivos estáticos servidos tal cual (p. ej. el worker de MapLibre, minificado):
    "public/**",
  ]),
  // src/components/ui/map.tsx es un componente vendido de mapcn (MIT, upstream
  // https://github.com/AnmolSaini16/mapcn); se mantiene cercano al original para
  // poder actualizarlo, así que se relajan las reglas de compilación estricta.
  {
    files: ["src/components/ui/map.tsx"],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
