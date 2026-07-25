/**
 * Base compartida de los "chips" de las tiras del footer (redes sociales y enlaces
 * rápidos). Mantiene el mismo alto, tipografía y espaciado en ambas secciones para
 * que se vean simétricas; cada tira sólo agrega sus colores.
 */
export const FOOTER_CHIP_BASE =
  "ease-expo inline-flex shrink-0 snap-start items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap rounded-full px-3 h-[34px] sm:px-4 sm:h-[42px] text-[11px] sm:text-[13px] font-semibold leading-none transition-all duration-300 active:scale-95 hover:-translate-y-1";

/** Tamaño uniforme para los íconos (SVG o emoji) dentro de un chip. */
export const FOOTER_CHIP_ICON =
  "inline-flex items-center justify-center h-3.5 w-3.5 sm:h-4 sm:w-4 text-[13px] sm:text-[15px] leading-none";

/**
 * Colores de marca de cada red social — FUENTE ÚNICA. Los usan por igual los pills
 * del landing (SocialLinksStrip), el footer y el modal "Quiénes somos", para que
 * TikTok/Instagram/Facebook se vean idénticos en todo el sitio. Solo definen fondo +
 * texto (blanco) + borde; cada lugar aporta su propio tamaño/forma. TikTok es negro,
 * así que lleva un borde tenue para separarse del fondo oscuro.
 */
export const SOCIAL_COLOR = {
  tiktok: "bg-[#000000] text-white border border-white/10",
  instagram: "bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F56040] text-white border border-transparent",
  facebook: "bg-[#1877F2] text-white border border-transparent",
} as const;
