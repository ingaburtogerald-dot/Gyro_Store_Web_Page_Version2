import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Instagram, Facebook, Star, MapPin, MessageCircle, Lightbulb } from "lucide-react";
import { useGetConfigQuery } from "~/store/api/catalogApi";
import { buildWhatsappUrl, cn } from "~/lib/utils";
import { GOOGLE_REVIEW_URL, WHATSAPP_DEFAULT_MESSAGE } from "~/lib/storeLinks";
import { FeedbackModal } from "./FeedbackModal";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.471-1.761-1.643-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

const FOOTER_CHIP =
  "ease-expo inline-flex shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-full border bg-surface-2/50 px-4 py-2.5 text-[13px] font-semibold transition-all duration-300 active:scale-95 shadow-sm";

export function MobileStoreActions() {
  const { data: config } = useGetConfigQuery();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  
  const address = config?.storeAddress ?? "Managua, Nicaragua";
  const whatsappUrl = config?.whatsapp ? buildWhatsappUrl(config.whatsapp, WHATSAPP_DEFAULT_MESSAGE) : null;
  const googleUrl = config?.reviewLinks?.google || GOOGLE_REVIEW_URL;
  const instagramUrl = config?.socialLinks?.instagram;
  const facebookUrl = config?.socialLinks?.facebook;
  const tiktokUrl = config?.socialLinks?.tiktok || "https://www.tiktok.com/@gyro_store";

  const reduce = useReducedMotion();

  const buttons = (
    <>
      <a href="/" className={cn(FOOTER_CHIP, "bg-gradient-to-r from-blue-500/15 to-indigo-500/15 border-blue-500/40 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.3)] hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]")}>
        🛍️ Catálogo
      </a>
      <a href="/?promo=true" className={cn(FOOTER_CHIP, "bg-gradient-to-r from-rose-500/15 to-pink-500/15 border-rose-500/40 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.3)] hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(244,63,94,0.5)] animate-[pulse_3s_ease-in-out_infinite]")}>
        🏷️ Ofertas
      </a>
      {whatsappUrl && (
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={cn(FOOTER_CHIP, "bg-gradient-to-r from-green-500/15 to-emerald-500/15 border-green-500/40 text-green-400 shadow-[0_0_12px_rgba(34,197,94,0.3)] hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(34,197,94,0.5)] animate-[pulse_2s_ease-in-out_infinite]")}>
          <WhatsAppIcon className="h-4 w-4" /> <span>WhatsApp</span>
        </a>
      )}
      <a href={googleUrl} target="_blank" rel="noopener noreferrer" className={cn(FOOTER_CHIP, "bg-gradient-to-r from-yellow-500/15 to-amber-500/15 border-yellow-500/40 text-yellow-400 shadow-[0_0_12px_rgba(234,179,8,0.3)] hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(234,179,8,0.5)]")}>
        ⭐ Reseña
      </a>
      <a
        href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
        target="_blank"
        rel="noreferrer"
        className={cn(FOOTER_CHIP, "bg-gradient-to-r from-purple-500/15 to-fuchsia-500/15 border-purple-500/40 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.3)] hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(168,85,247,0.5)]")}
      >
        📍 Ubicación
      </a>
      <button type="button" onClick={() => setFeedbackOpen(true)} className={cn(FOOTER_CHIP, "bg-gradient-to-r from-cyan-500/15 to-teal-500/15 border-cyan-500/40 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)] hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(6,182,212,0.5)]")}>
        💡 Tu opinión
      </button>
    </>
  );

  return (
    <div className="md:hidden mt-8 mb-2">
      <div className="rounded-2xl border border-white/5 bg-surface-2/20 p-4 shadow-sm">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-text flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          <span>Enlaces Rápidos</span>
        </h3>
        
        {reduce ? (
          <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {buttons}
          </div>
        ) : (
          <div className="group/marquee marquee-mask relative overflow-hidden pb-2 pt-1">
            <div className="animate-marquee flex w-max items-center gap-2.5" style={{ "--marquee-duration": "30s" } as React.CSSProperties}>
              {buttons}
              <div aria-hidden="true" className="flex items-center gap-2.5">
                {buttons}
              </div>
            </div>
          </div>
        )}
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
