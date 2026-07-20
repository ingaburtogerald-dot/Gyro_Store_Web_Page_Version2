import { motion, useReducedMotion } from "framer-motion";
import { cn, formatCordobas } from "~/lib/utils";
import type { DiscountTier } from "~/store/api/catalogApi";

interface VolumePriceCardProps {
  label: string;
  qty: number;
  active: boolean;
  basePrice: number;
  tier: DiscountTier | null;
  onClick: () => void;
}

export function VolumePriceCard({ label, qty, active, basePrice, tier, onClick }: VolumePriceCardProps) {
  const reduce = useReducedMotion();
  const pct = tier?.discountPercent ?? 0;
  const unitPrice = Math.round(basePrice * (1 - pct / 100));
  const saved = Math.round(basePrice - unitPrice);

  return (
    <motion.button
      whileHover={reduce ? undefined : { y: -3, transition: { type: "spring", stiffness: 260, damping: 24 } }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      type="button"
      onClick={onClick}
      className={cn(
        // h-full: dentro de la grilla/fila las 3 cards ya se estiran a la misma altura
        // (align-items:stretch por defecto); sin esto el botón se quedaba con su
        // altura de contenido y "Media docena" (2 líneas) se veía más alta que el resto.
        // Compacta a propósito: las 3 deben caber SIEMPRE en línea, también a 375px
        // (un tercio de ancho ≈ 105px), así que el padding/tipografía son mínimos.
        // w-full: el botón DEBE llenar su celda del grid. Sin esto encogía a su propio
        // contenido y, como "Media docena" es más ancho, las 3 cards salían con anchos
        // distintos (87/122/86px) — la asimetría reportada. Con w-full quedan iguales.
        "relative flex h-full w-full min-w-0 flex-col items-start rounded-xl border p-2 sm:p-4 text-left transition-colors ease-expo duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        active
          ? "border-accent bg-surface-hover shadow-[0_4px_24px_rgba(0,0,0,0.25)]"
          : "border-border bg-surface-2 hover:border-white/25 hover:bg-surface-hover",
      )}
    >
      {/* Radio Button Visual */}
      <div className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full border border-border sm:right-3 sm:top-3 sm:h-5 sm:w-5">
        {active && <div className="h-2 w-2 rounded-full bg-accent sm:h-2.5 sm:w-2.5" />}
      </div>

      <span className="w-full truncate text-[10px] font-medium uppercase leading-tight tracking-wide text-muted pr-5 sm:text-xs sm:pr-6">
        {label}
      </span>
      <span className="mt-0.5 text-[10px] leading-tight text-muted sm:text-xs">{qty} uds</span>

      <span className="mt-2 text-sm font-bold tabular-nums leading-tight text-accent sm:mt-3 sm:text-xl">
        {formatCordobas(unitPrice)}
      </span>
      <span className="text-[10px] leading-tight text-muted line-through sm:text-xs">
        {formatCordobas(basePrice)}
      </span>

      {/* Espacio del badge SIEMPRE reservado (min-h), así las 3 cards alinean su
          borde inferior sin recurrir a texto invisible (ese hack seguía expuesto
          a lectores de pantalla aunque fuera invisible en pantalla). */}
      <div className="mt-1.5 min-h-[18px] sm:mt-2 sm:min-h-[22px]">
        {saved > 0 && (
          <span className="whitespace-nowrap rounded-md bg-accent-2/10 px-1.5 py-0.5 text-[9px] font-bold text-accent-2 sm:px-2 sm:text-[11px]">
            -{formatCordobas(saved)}<span className="hidden sm:inline"> c/u</span>
          </span>
        )}
      </div>
    </motion.button>
  );
}
