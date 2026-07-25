// Footer del catálogo (centrado, minimalista): foto del negocio + nombre, señales de
// confianza, ubicación, acciones de contacto (reseña · WhatsApp · opinión) y barra
// inferior con derechos reservados y crédito.
// Las acciones antes eran botones flotantes (FABs) en las esquinas; se movieron aquí
// (y al menú móvil) para dejar la pantalla limpia.
//
// Compacto en móvil (≤640px) a propósito: logo chico, señales en chips que envuelven
// a 1-2 líneas, acciones en una fila delgada y barra inferior mínima. Desde md el
// diseño vuelve al centrado/3-columnas original — ningún cambio aquí toca desktop.
import { Instagram, Facebook } from "lucide-react";
import { Link } from "@remix-run/react";
import { Logo } from "~/components/ui/Logo";
import { useGetConfigQuery } from "~/store/api/catalogApi";
import { TRUST_SIGNALS } from "~/lib/trustSignals";
import { SOCIAL_COLOR } from "~/lib/chipStyles";

export function PublicFooter() {
  const { data: config } = useGetConfigQuery();
  const year = new Date().getFullYear();
  const instagramUrl = config?.socialLinks?.instagram;
  const facebookUrl = config?.socialLinks?.facebook;
  const tiktokUrl = config?.socialLinks?.tiktok || "https://www.tiktok.com/@gyro_store";

  return (
    <footer id="public-footer" className="relative mt-4 md:mt-8 border-t border-white/5 bg-surface pt-4 pb-4 md:pt-12 md:pb-6 overflow-hidden">
      {/* Línea de acento superior con glow (Premium E-commerce) */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent shadow-[0_0_15px_rgba(var(--color-accent),0.4)]" />

      <div className="mx-auto max-w-6xl px-6 md:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="md:hidden mix-blend-screen">
            <Logo size={48} />
          </div>
          <div className="hidden md:block mix-blend-screen">
            <Logo size={100} />
          </div>
          
          <p className="mt-3 max-w-md text-[11px] md:text-sm leading-relaxed text-muted text-pretty">
            La tienda de tecnología con el mejor servicio al cliente de Nicaragua. Calidad, garantía y envíos seguros a todo el país.
          </p>

          {/* Trust signals removed to reduce mobile footer size */}

          {/* Social Media Links */}
          <div className="mt-6 flex flex-col items-center justify-center">
            <div className="flex items-center gap-4">
            {instagramUrl && (
              <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={`flex h-8 w-8 md:h-12 md:w-12 items-center justify-center rounded-full transition-all duration-300 hover:-translate-y-1 hover:scale-110 hover:shadow-lg active:scale-95 ${SOCIAL_COLOR.instagram}`}>
                <Instagram className="h-4 w-4 md:h-5 md:w-5" />
              </a>
            )}
            {facebookUrl && (
              <a href={facebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className={`flex h-8 w-8 md:h-12 md:w-12 items-center justify-center rounded-full transition-all duration-300 hover:-translate-y-1 hover:scale-110 hover:shadow-lg active:scale-95 ${SOCIAL_COLOR.facebook}`}>
                <Facebook className="h-4 w-4 md:h-5 md:w-5" />
              </a>
            )}
            {tiktokUrl && (
              <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className={`flex h-8 w-8 md:h-12 md:w-12 items-center justify-center rounded-full transition-all duration-300 hover:-translate-y-1 hover:scale-110 hover:shadow-lg active:scale-95 ${SOCIAL_COLOR.tiktok}`}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 md:h-5 md:w-5">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.34 2.88 2.88 0 0 1 2.31-4.53 2.66 2.66 0 0 1 1.04.2v-3.2A5.99 5.99 0 0 0 3.32 15a5.95 5.95 0 0 0 11.23 2.14v-6.32a8.04 8.04 0 0 0 5.04 1.76v-3.15a4.7 4.7 0 0 1-2.19-.51Z" />
                </svg>
              </a>
            )}
            </div>
          </div>
        </div>

        {/* Nav links removed to reduce mobile footer size */}

        {/* Barra inferior: compacta y en una sola tipografía menor en móvil. */}
        <div className="mt-4 md:mt-12 border-t border-white/10 pt-3 md:pt-6 flex flex-col md:flex-row items-center justify-center md:justify-between gap-2 md:gap-4 text-[10px] md:text-xs text-muted text-center">
          <p className="max-w-[250px] md:max-w-none">© {year} Gyro Store · Todos los derechos reservados.</p>
          <p className="max-w-[250px] md:max-w-none leading-relaxed">
            Diseñado y desarrollado por <span className="font-medium text-text block sm:inline">Ing. Gerald Aburto</span>
            <span className="hidden sm:inline mx-1.5 text-border">·</span>
            <a href="mailto:ingaburtogerald@gmail.com" className="text-accent-2 transition-colors hover:text-accent block sm:inline">
              ingaburtogerald@gmail.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
