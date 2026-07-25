import { Instagram, Facebook } from "lucide-react";
import { useGetConfigQuery } from "~/store/api/catalogApi";
import { FOOTER_CHIP_BASE, FOOTER_CHIP_ICON, SOCIAL_COLOR } from "~/lib/chipStyles";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.12-3.44-3.17-3.41-5.46.02-2.12 1.25-4.14 3.09-5.18 1.05-.59 2.27-.88 3.5-.88v4.03c-.56.03-1.13.16-1.64.44-.75.42-1.34 1.1-1.51 1.95-.14.7.07 1.44.53 1.98.53.62 1.34.97 2.15.91.82-.07 1.55-.48 2.01-1.14.39-.55.6-1.22.61-1.9.02-3.87.01-7.74.02-11.61h4.08v.02c-.06.26-.14.52-.25.77-.13.3-.29.58-.47.85.01-.01 0 0 0 0" />
    </svg>
  );
}

export function SocialLinksStrip() {
  const { data: config } = useGetConfigQuery();
  
  // Utiliza los links configurados en la BD, con fallbacks a las páginas oficiales por si no están.
  const instagramUrl = config?.socialLinks?.instagram || "https://instagram.com/gyro_store";
  const facebookUrl = config?.socialLinks?.facebook || "https://facebook.com/gyro_store";
  const tiktokUrl = config?.socialLinks?.tiktok || "https://www.tiktok.com/@gyro_store";

  const renderButtons = () => (
    <>
      <a
        href={tiktokUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${FOOTER_CHIP_BASE} ${SOCIAL_COLOR.tiktok} shadow-sm hover:shadow-[0_4px_15px_rgba(255,255,255,0.2)]`}
      >
        <TikTokIcon className={FOOTER_CHIP_ICON} />
        <span>TikTok</span>
      </a>

      <a
        href={instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${FOOTER_CHIP_BASE} ${SOCIAL_COLOR.instagram} shadow-sm hover:shadow-[0_4px_15px_rgba(253,29,29,0.3)]`}
      >
        <Instagram className={FOOTER_CHIP_ICON} />
        <span>Instagram</span>
      </a>

      <a
        href={facebookUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${FOOTER_CHIP_BASE} ${SOCIAL_COLOR.facebook} shadow-sm hover:shadow-[0_4px_15px_rgba(24,119,242,0.3)]`}
      >
        <Facebook className={FOOTER_CHIP_ICON} />
        <span>Facebook</span>
      </a>
    </>
  );

  return (
    <section aria-label="Redes Sociales" className="mx-auto w-full max-w-[1400px] px-4 pb-4 pt-1 sm:pb-6 sm:pt-4">
      <div className="rounded-2xl border border-white/5 bg-surface-2/20 p-4 shadow-sm">
        <h3 className="mb-2.5 sm:mb-3 text-[10px] sm:text-xs font-bold text-text flex items-center gap-1.5 sm:gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          <span>Visita nuestras redes sociales</span>
        </h3>
        
        {/* Mobile: Scroll horizontal */}
        <div className="md:hidden flex gap-2.5 overflow-x-auto pb-3 pt-1 -mx-4 px-4 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {renderButtons()}
        </div>

        {/* Desktop: Static buttons */}
        <div className="hidden md:flex flex-wrap items-center justify-center gap-4 pb-2 pt-1">
          {renderButtons()}
        </div>
      </div>
    </section>
  );
}
