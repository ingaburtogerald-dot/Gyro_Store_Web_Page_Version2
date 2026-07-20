// Shell ligero del storefront público (home, combos, contacto). Monta el header
// full-width (PublicHeader, estilo Apple/Razer) arriba y el contenido debajo.
//
// El rail persistente (AppShell) YA NO se usa aquí: queda reservado para /admin/*,
// donde sigue sirviendo la navegación "Mi negocio". Así el header nuevo toma todo
// el protagonismo en la tienda sin borrar el rail.
//
// El padding del <main> replica el de AppShell (p-4 / md:p-6) para que las páginas
// que compensan ese padding con márgenes negativos (p.ej. la barra de categorías
// sticky de la home, con -mt-4/-mt-6 y top-16) sigan alineadas.
import type { ReactNode } from "react";
import { useLocation } from "@remix-run/react";
import { motion } from "framer-motion";
import { PublicHeader } from "./PublicHeader";

export function StorefrontShell({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        // pb-12 en móvil: aire al cierre del contenido antes del footer. md:p-6
        // restaura el padding original desde el breakpoint.
        className="flex-1 p-4 pb-12 md:p-6"
      >
        {children}
      </motion.main>
    </div>
  );
}
