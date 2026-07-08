import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

declare module "@remix-run/node" {
  interface Future {
    v3_singleFetch: true;
  }
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    tsconfigPaths(),
  ],
  resolve: {
    // shared/ resuelve zod desde el node_modules raíz: dedupe garantiza una
    // sola instancia de zod en el bundle (la de frontend/node_modules).
    dedupe: ["zod"],
  },
  server: {
    // PORT permite levantar una segunda instancia (p.ej. preview de Claude)
    // sin chocar con el dev server habitual en 5173.
    port: Number(process.env.PORT) || 5173,
    watch: {
      usePolling: true,
    },
    fs: {
      // Permite servir ../shared (schemas compartidos con el servidor).
      allow: [".."],
    },
    // Proxy de la API al servidor Express durante el desarrollo
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
