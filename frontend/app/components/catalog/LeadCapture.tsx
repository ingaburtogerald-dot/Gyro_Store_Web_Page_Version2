// Captura de leads: "dejá tu reseña, te damos un código de descuento". El código
// NO se emite solo — el admin revisa la reseña real en Google/Facebook y lo crea
// a mano desde /admin/codigos-descuento (ver ese panel + orders.js para el canje).
//
// Es un banner EMBEBIDO en la home (antes del footer). El antiguo ExitIntentPopup
// (popup que saltaba al intentar salir) se eliminó por intrusivo: las acciones de
// reseña ahora viven embebidas aquí, en el menú y en el footer.
import { Star } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { useGetConfigQuery } from "~/store/api/catalogApi";
import { GOOGLE_REVIEW_URL, FACEBOOK_REVIEW_URL } from "~/lib/storeLinks";

function ReviewPitch() {
  const { data: config } = useGetConfigQuery();
  const googleUrl = config?.reviewLinks?.google || GOOGLE_REVIEW_URL;
  const facebookUrl = config?.reviewLinks?.facebook || FACEBOOK_REVIEW_URL;

  return (
    <div className="text-center sm:text-left">
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-accent/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-2">
        <Star className="h-3.5 w-3.5 fill-current" /> Dejá tu reseña
      </span>
      <h2 className="mt-3 font-heading text-xl font-bold text-text sm:text-2xl">
        Contanos cómo te fue y te damos un código de descuento
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        Escribinos una reseña en Google (o Facebook) — la revisamos y te mandamos un código para tu próxima compra.
      </p>
      <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row">
        <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
          <Button size="lg" className="w-full sm:w-auto">
            Dejar reseña en Google
          </Button>
        </a>
        {facebookUrl && (
          <a
            href={facebookUrl}
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
