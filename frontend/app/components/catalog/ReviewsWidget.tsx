// Reseñas REALES de Google + Facebook vía widget de terceros (Elfsight).
//
// CÓMO ACTIVARLO (una sola vez, sin tocar más código):
//   1. Creá una cuenta gratis en https://elfsight.com y añadí el widget
//      "Google Reviews" (o "Google + Facebook Reviews"). Conectá tu ficha de
//      Google y tu página de Facebook desde su panel.
//   2. Al publicarlo te da un id con forma  elfsight-app-XXXXXXXX-XXXX-...
//   3. Pegá ESE id en ELFSIGHT_WIDGET_ID abajo. Listo: se muestran solas.
//
// Mientras el id esté vacío, NO se muestran reseñas de ejemplo (falsas): en su
// lugar aparece una tarjeta real que lleva a las reseñas de Google del negocio.
import { useEffect } from "react";
import { Star, ArrowUpRight } from "lucide-react";
import { GOOGLE_REVIEW_URL } from "~/lib/storeLinks";
import { useGetConfigQuery } from "~/store/api/catalogApi";

// ⬇️ Pegá aquí el id del widget de Elfsight (ver instrucciones arriba). Vacío = fallback.
const ELFSIGHT_WIDGET_ID = "";

const PLATFORM_SRC = "https://static.elfsight.com/platform/platform.js";

/** Inyecta el script de la plataforma de Elfsight una sola vez en <body>. */
function useElfsightPlatform(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    if (document.querySelector(`script[src="${PLATFORM_SRC}"]`)) return;
    const s = document.createElement("script");
    s.src = PLATFORM_SRC;
    s.async = true;
    document.body.appendChild(s);
  }, [enabled]);
}

export function ReviewsWidget() {
  const { data: config } = useGetConfigQuery();
  const googleUrl = config?.reviewLinks?.google || GOOGLE_REVIEW_URL;
  const configured = ELFSIGHT_WIDGET_ID.trim().length > 0;
  useElfsightPlatform(configured);

  if (configured) {
    // Elfsight monta el widget dentro de este div (su className ES el id).
    return <div className={ELFSIGHT_WIDGET_ID} data-elfsight-app-lazy />;
  }

  // Fallback (sin id aún): NADA de reseñas falsas — una tarjeta real a Google.
  return (
    <a
      href={googleUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-surface/40 px-6 py-10 text-center transition-colors hover:border-accent/40 hover:bg-surface/60"
    >
      <div className="flex items-center gap-1" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="h-5 w-5 fill-accent-2 text-accent-2" />
        ))}
      </div>
      <p className="max-w-md text-balance text-sm text-muted">
        Lee las reseñas reales de nuestros clientes en Google — y si ya compraste, dejanos la tuya.
      </p>
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-accent-2 transition-transform group-hover:translate-x-0.5">
        Ver reseñas en Google <ArrowUpRight className="h-4 w-4" />
      </span>
    </a>
  );
}
