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
        // w-full: el botón DEBE llenar su celda del grid.
        "relative flex h-full w-full min-w-0 flex-col items-start rounded-xl border p-2 sm:p-4 text-left transition-all ease-expo duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        active
          ? "border-accent bg-accent/10 shadow-[0_4px_24px_rgba(var(--color-accent),0.2)] ring-1 ring-accent/30"
          : "border-white/10 bg-surface-2 hover:border-accent/40 hover:bg-surface-hover hover:shadow-[0_4px_20px_rgba(var(--color-accent),0.1)]",
      )}
    >
      {/* Radio Button Visual */}
      <div className={cn("absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full border transition-colors sm:right-3 sm:top-3 sm:h-5 sm:w-5", active ? "border-accent bg-accent/20" : "border-border")}>
        {active && <div className="h-2 w-2 rounded-full bg-accent sm:h-2.5 sm:w-2.5 shadow-[0_0_8px_rgba(var(--color-accent),0.8)]" />}
      </div>

      <span className={cn("w-full truncate text-[10px] font-bold uppercase leading-tight tracking-wider pr-5 sm:text-xs sm:pr-6 transition-colors", active ? "text-accent" : "text-muted")}>
        {label}
      </span>
      <span className={cn("mt-0.5 text-[10px] leading-tight sm:text-xs transition-colors", active ? "text-text" : "text-muted")}>{qty} uds</span>

      <span className="mt-2 text-sm font-bold tabular-nums leading-tight text-accent sm:mt-3 sm:text-xl">
        {formatCordobas(unitPrice)}
      </span>
      <span className={cn("text-[10px] leading-tight line-through sm:text-xs transition-colors", active ? "text-muted" : "text-muted/70")}>
        {formatCordobas(basePrice)}
      </span>

      {/* Espacio del badge SIEMPRE reservado */}
      <div className="mt-1.5 min-h-[18px] sm:mt-2 sm:min-h-[22px]">
        {saved > 0 && (
          <span className={cn("whitespace-nowrap rounded-md px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide sm:px-2 sm:text-[11px] ring-1 transition-all", active ? "bg-accent/20 text-accent ring-accent/40 shadow-[0_0_12px_rgba(var(--color-accent),0.3)]" : "bg-accent/10 text-accent/80 ring-accent/20")}>
            -{formatCordobas(saved)}<span className="hidden sm:inline"> c/u</span>
          </span>
        )}
      </div>
    </motion.button>
  );
}
