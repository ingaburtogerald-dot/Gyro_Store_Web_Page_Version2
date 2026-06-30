// Config de Vitest SEPARADA de vite.config.ts: el plugin de Remix no es compatible
// con el runner de Vitest. Aquí solo necesitamos resolver el alias "~/" (vía
// tsconfigPaths) y un entorno node — la capa de dominio es pura, sin DOM.
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["app/**/*.{test,spec}.{ts,tsx}"],
  },
});
