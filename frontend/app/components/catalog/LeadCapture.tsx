// Captura de leads: "dejá tu reseña, te damos un código de descuento". El código
// NO se emite solo — el admin revisa la reseña real en Google/Facebook y lo crea
// a mano desde /admin/codigos-descuento (ver ese panel + orders.js para el canje).
//
// Dos piezas:
//   · LeadCapture      → banner fijo en la home, antes del footer.
//   · ExitIntentPopup  → opcional, se dispara cuando el mouse sale por ARRIBA del
//     viewport (intención real de irse, no un scroll cualquiera). Se muestra UNA
//     vez por sesión (sessionStorage) y respeta prefers-reduced-motion.
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Star, X } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { useGetConfigQuery } from "~/store/api/catalogApi";

// Ficha de Google Maps del negocio (ya usada en AboutUsModal.tsx) — desde ahí el
// cliente puede tocar "Escribir una reseña" directamente en Google.
const GOOGLE_REVIEW_URL = "https://maps.app.goo.gl/WsvH83yGzzsrkYKE8";
const EXIT_INTENT_KEY = "gyro_exit_intent_shown";

function ReviewPitch({ compact = false }: { compact?: boolean }) {
  const { data: config } = useGetConfigQuery();
  return (
    <div className={compact ? "text-center" : "text-center sm:text-left"}>
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-accent/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-2">
        <Star className="h-3.5 w-3.5 fill-current" /> Dejá tu reseña
      </span>
      <h2 className={compact ? "mt-3 font-heading text-lg font-bold text-text" : "mt-3 font-heading text-xl font-bold text-text sm:text-2xl"}>
        Contanos cómo te fue y te damos un código de descuento
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        Escribinos una reseña en Google (o Facebook) — la revisamos y te mandamos un código para tu próxima compra.
      </p>
      <div className={cnJoin("mt-4 flex flex-col gap-2", compact ? "items-center" : "items-center sm:flex-row")}>
        <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
          <Button size={compact ? "md" : "lg"} className="w-full sm:w-auto">
            Dejar reseña en Google
          </Button>
        </a>
        {config?.socialLinks?.facebook && (
          <a
            href={config.socialLinks.facebook}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-muted underline decoration-border underline-offset-4 transition-colors hover:text-text"
          >
            o dejala en Facebook
          </a>
        )}
      </div>
    </div>
  );
}

// Pequeño helper local para no traer cn solo por dos clases condicionales acá.
function cnJoin(...cls: (string | false | undefined)[]) {
  return cls.filter(Boolean).join(" ");
}

export function LeadCapture() {
  return (
    <section
      aria-label="Dejanos tu reseña"
      className="rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/10 via-surface/40 to-transparent p-6 sm:p-8"
    >
      <ReviewPitch />
    </section>
  );
}

export function ExitIntentPopup() {
  const [show, setShow] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(EXIT_INTENT_KEY)) return;
    } catch {
      return; // sessionStorage bloqueado (privacidad estricta) → no molestar, no repetir intento
    }

    function onMouseLeave(e: MouseEvent) {
      // clientY <= 0: el mouse salió por ARRIBA del viewport (rumbo a pestañas/URL),
      // la señal clásica de "me estoy yendo" — no cualquier mouseleave del documento.
      if (e.clientY > 0) return;
      setShow(true);
      try {
        sessionStorage.setItem(EXIT_INTENT_KEY, "1");
      } catch {
        /* noop */
      }
      document.removeEventListener("mouseleave", onMouseLeave);
    }

    document.addEventListener("mouseleave", onMouseLeave);
    return () => document.removeEventListener("mouseleave", onMouseLeave);
  }, []);

  function dismiss() {
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            key="exit-intent-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            onClick={dismiss}
            className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            key="exit-intent-panel"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: reduce ? 0.15 : 0.3, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Dejanos tu reseña"
            className="fixed left-1/2 top-1/2 z-[70] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-accent/20 bg-surface p-6 shadow-premium"
          >
            <button
              type="button"
              onClick={dismiss}
              aria-label="Cerrar"
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              <X className="h-4 w-4" />
            </button>
            <ReviewPitch compact />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
