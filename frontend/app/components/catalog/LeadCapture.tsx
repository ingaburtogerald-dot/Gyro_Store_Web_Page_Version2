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

import { useState } from "react";
import { ReviewChoiceModal } from "~/components/catalog/ReviewChoiceModal";

function ReviewPitch() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="text-center sm:text-left">
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-accent/15 px-2 py-0.5 text-[9px] sm:px-3 sm:py-1 sm:text-xs font-bold uppercase tracking-wide text-accent-2">
        <Star className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 fill-current" /> Dejá tu reseña
      </span>
      <h2 className="mt-3 font-heading text-[15px] font-bold text-text sm:text-2xl">
        Contanos cómo te fue y te damos un código de descuento
      </h2>
      <p className="mt-1 text-[12px] text-muted sm:text-sm sm:mt-1.5">
        Escribinos una reseña en Google o Facebook — la revisamos y te mandamos un código para tu próxima compra.
      </p>
      <div className="mt-4 flex justify-center sm:justify-start">
        <Button onClick={() => setModalOpen(true)} className="w-full h-9 text-xs sm:h-12 sm:px-8 sm:text-base sm:w-auto">
          Dejar reseña
        </Button>
      </div>

      <ReviewChoiceModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}

export function LeadCapture() {
  return (
    <section
      aria-label="Dejanos tu reseña"
      className="rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/10 via-surface/40 to-transparent p-4 sm:p-8"
    >
      <ReviewPitch />
    </section>
  );
}
