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
