import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { useGetConfigQuery } from "~/store/api/catalogApi";
import { buildWhatsappUrl, cn } from "~/lib/utils";
import { GOOGLE_REVIEW_URL, WHATSAPP_DEFAULT_MESSAGE } from "~/lib/storeLinks";
import { FeedbackModal } from "~/components/layout/FeedbackModal";
import { ReviewChoiceModal } from "~/components/catalog/ReviewChoiceModal";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.471-1.761-1.643-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

const FOOTER_CHIP =
  "ease-expo inline-flex shrink-0 snap-start items-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-full border border-border bg-surface-2/60 px-3 py-2 text-[11px] sm:px-4 sm:py-2.5 sm:text-[13px] font-semibold text-text transition-all duration-300 active:scale-95 shadow-sm hover:border-accent/40 hover:text-accent-2 hover:-translate-y-1";

export function QuickLinksStrip() {
  const { data: config } = useGetConfigQuery();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  
  const address = config?.storeAddress ?? "Managua, Nicaragua";
  const whatsappUrl = config?.whatsapp ? buildWhatsappUrl(config.whatsapp, WHATSAPP_DEFAULT_MESSAGE) : null;
  const googleUrl = config?.reviewLinks?.google || GOOGLE_REVIEW_URL;

  const reduce = useReducedMotion();

  const buttons = (
    <>
      <button type="button" onClick={() => setFeedbackOpen(true)} className={FOOTER_CHIP}>
        💡 Tu opinión
      </button>
      <button type="button" onClick={() => setReviewModalOpen(true)} className={FOOTER_CHIP}>
        ⭐ Reseña
      </button>
      <a href="/#catalogo" className={FOOTER_CHIP}>
        🛍️ Catálogo
      </a>
      <a href="/?promo=true" className={FOOTER_CHIP}>
        🏷️ Ofertas
      </a>
      {whatsappUrl && (
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={FOOTER_CHIP}>
          <WhatsAppIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span>WhatsApp</span>
        </a>
      )}
      <a
        href={googleUrl}
        target="_blank"
        rel="noreferrer"
        className={FOOTER_CHIP}
      >
        📍 Ubicación
      </a>
    </>
  );

  return (
    <section
      aria-label="Enlaces Rápidos"
      className="mx-auto w-full max-w-[1400px] px-4 pb-4 pt-1 sm:pb-6 sm:pt-4"
    >
      <div className="rounded-2xl border border-white/5 bg-surface-2/20 p-4 shadow-sm">
        <h3 className="mb-2.5 sm:mb-3 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-text flex items-center gap-1.5 sm:gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          <span>Enlaces Rápidos</span>
        </h3>
        {/* Mobile: Scroll horizontal */}
        <div className="md:hidden flex gap-2.5 overflow-x-auto pb-3 pt-1 -mx-4 px-4 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {buttons}
        </div>

        {/* Desktop: Static buttons */}
        <div className="hidden md:flex flex-wrap items-center justify-center gap-4 pb-2 pt-1">
          {buttons}
        </div>
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <ReviewChoiceModal open={reviewModalOpen} onClose={() => setReviewModalOpen(false)} />
    </section>
  );
}
