// Footer del catálogo (centrado, minimalista): foto del negocio + nombre, señales de
// confianza, ubicación, acciones de contacto (reseña · WhatsApp · opinión) y barra
// inferior con derechos reservados y crédito.
// Las acciones antes eran botones flotantes (FABs) en las esquinas; se movieron aquí
// (y al menú móvil) para dejar la pantalla limpia.
//
// Compacto en móvil (≤640px) a propósito: logo chico, señales en chips que envuelven
// a 1-2 líneas, acciones en una fila delgada y barra inferior mínima. Desde md el
// diseño vuelve al centrado/3-columnas original — ningún cambio aquí toca desktop.
import { useState } from "react";
import { MapPin, Star, MessageCircle, Lightbulb } from "lucide-react";
import { Logo } from "~/components/ui/Logo";
import { useGetConfigQuery } from "~/store/api/catalogApi";
import { TRUST_SIGNALS } from "~/lib/trustSignals";
import { buildWhatsappUrl } from "~/lib/utils";
import { GOOGLE_REVIEW_URL, WHATSAPP_DEFAULT_MESSAGE } from "~/lib/storeLinks";
import { FeedbackModal } from "./FeedbackModal";

const ACTION_CLS =
  "ease-expo inline-flex items-center gap-2 rounded-pill border border-border bg-surface-2/40 px-4 py-2 text-sm font-semibold text-text transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-surface-2 hover:text-accent-2 hover:shadow-[0_8px_20px_-12px_rgba(0,0,0,0.4)] active:translate-y-0 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function PublicFooter() {
  const { data: config } = useGetConfigQuery();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const year = new Date().getFullYear();
  const address = config?.storeAddress ?? "Managua, Nicaragua";
  const whatsappUrl = config?.whatsapp ? buildWhatsappUrl(config.whatsapp, WHATSAPP_DEFAULT_MESSAGE) : null;

  const googleUrl = config?.reviewLinks?.google || GOOGLE_REVIEW_URL;

  return (
    <footer className="relative mt-12 md:mt-20 border-t border-white/5 bg-surface pt-10 md:pt-16 pb-6 overflow-hidden">
      {/* Línea de acento superior con glow (Premium E-commerce) */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent shadow-[0_0_15px_rgba(var(--color-accent),0.4)]" />

      <div className="mx-auto max-w-6xl px-6 md:px-8">
        <div className="grid gap-8 md:gap-12 md:grid-cols-[2fr_1fr_1fr] lg:gap-16">
          {/* Columna 1: Marca y confianza */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            {/* Logo más chico en móvil: `size` fija un alto vía style inline, así que
                no hay forma de hacerlo responsive con una sola instancia — se montan
                dos y se alterna cuál se ve por breakpoint. */}
            <div className="md:hidden">
              <Logo size={44} withText textClassName="text-xl" />
            </div>
            <div className="hidden md:block">
              <Logo size={80} withText textClassName="text-3xl sm:text-4xl" />
            </div>
            <p className="mt-4 md:mt-6 max-w-sm text-sm text-muted leading-relaxed">
              La tienda de tecnología con el mejor servicio al cliente de Nicaragua. Calidad, garantía y envíos seguros a todo el país.
            </p>
            {/* Señales de confianza: chips compactos que envuelven (1-2 líneas) en
                móvil; desde md vuelve a la grilla de texto plano original. */}
            <div className="mt-5 md:mt-8 flex flex-wrap justify-center gap-2 md:grid md:grid-cols-2 md:gap-3 text-xs font-medium text-text/80 w-full md:w-auto">
              {TRUST_SIGNALS.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center justify-center md:justify-start gap-1.5 md:gap-2 bg-surface-2/40 md:bg-transparent px-2.5 py-1.5 md:p-0 rounded-full md:rounded-none"
                >
                  <Icon className="h-3.5 w-3.5 md:h-4 md:w-4 text-accent" /> {label}
                </span>
              ))}
            </div>
          </div>

          {/* Columna 2: Enlaces Rápidos */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <h4 className="font-heading text-base md:text-lg font-bold text-text mb-3 md:mb-5">Explorar</h4>
            <nav className="flex flex-col gap-1.5 md:gap-3 w-full md:w-auto">
              <a href="/" className="py-2 md:py-0 text-sm md:text-sm text-muted transition-colors hover:text-accent md:hover:translate-x-1 duration-200 bg-surface-2/20 md:bg-transparent rounded-xl md:rounded-none">
                Catálogo de Productos
              </a>
              <a href="/?promo=true" className="py-2 md:py-0 text-sm md:text-sm text-muted transition-colors hover:text-accent md:hover:translate-x-1 duration-200 bg-surface-2/20 md:bg-transparent rounded-xl md:rounded-none">
                Ofertas Especiales
              </a>
              <button type="button" onClick={() => setFeedbackOpen(true)} className="w-full text-center md:text-left py-2 md:py-0 text-sm md:text-sm text-muted transition-colors hover:text-accent md:hover:translate-x-1 duration-200 bg-surface-2/20 md:bg-transparent rounded-xl md:rounded-none">
                Danos tu opinión
              </button>
            </nav>
          </div>

          {/* Columna 3: Contacto y Soporte */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <h4 className="font-heading text-base md:text-lg font-bold text-text mb-3 md:mb-5">Contacto</h4>
            <div className="flex flex-col gap-3 md:gap-6 w-full md:w-auto">
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-row items-start gap-2 md:gap-3 text-sm text-muted transition-colors hover:text-text group bg-surface-2/20 md:bg-transparent p-3 md:p-0 rounded-xl md:rounded-none"
              >
                <MapPin className="h-5 w-5 shrink-0 text-accent-2 transition-transform group-hover:scale-110" />
                <span className="leading-relaxed">{address}</span>
              </a>

              {/* Acciones en una sola fila compacta (WhatsApp · Reseña). */}
              <div className="flex flex-row md:flex-col justify-center gap-2 md:gap-3 w-full">
                {whatsappUrl && (
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={`${ACTION_CLS} flex-1 md:flex-none justify-center py-2.5 md:py-2`}>
                    <MessageCircle className="h-4 w-4 md:h-4 md:w-4 text-whatsapp" /> WhatsApp
                  </a>
                )}
                <a href={googleUrl} target="_blank" rel="noopener noreferrer" className={`${ACTION_CLS} flex-1 md:flex-none justify-center py-2.5 md:py-2`}>
                  <Star className="h-4 w-4 md:h-4 md:w-4 text-accent-2" /> Reseña
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Barra inferior: compacta y en una sola tipografía menor en móvil. */}
        <div className="mt-8 md:mt-16 border-t border-white/10 pt-5 md:pt-8 flex flex-col md:flex-row items-center justify-between gap-1.5 md:gap-4 text-[11px] md:text-xs text-muted">
          <p>© {year} Gyro Store · Todos los derechos reservados.</p>
          <p>
            Diseñado y desarrollado por <span className="font-medium text-text">Ing. Gerald Aburto</span>
            <span className="mx-1.5 text-border">·</span>
            <a href="mailto:ingaburtogerald@gmail.com" className="text-accent-2 transition-colors hover:text-accent">
              ingaburtogerald@gmail.com
            </a>
          </p>
        </div>
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </footer>
  );
}
