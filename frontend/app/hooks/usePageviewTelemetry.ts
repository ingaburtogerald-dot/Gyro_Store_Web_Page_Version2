// Registra una visita (pageview) cada vez que cambia la ruta. Se monta una sola vez
// en la raíz. Excluye rutas internas (admin/login): el "tráfico real" son clientes
// del storefront, no el staff. El candado de localhost vive en logPageview.
import { useEffect } from "react";
import { useLocation } from "@remix-run/react";
import { logPageview } from "~/lib/searchTelemetry";

const EXCLUDED_PREFIXES = ["/admin", "/login"];

export function usePageviewTelemetry() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) return;
    logPageview(pathname);
  }, [pathname]);
}
