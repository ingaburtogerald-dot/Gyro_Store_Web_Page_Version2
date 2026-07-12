import { motion } from "framer-motion";
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
  const pct = tier?.discountPercent ?? 0;
  const unitPrice = Math.round(basePrice * (1 - pct / 100));
  const saved = Math.round(basePrice - unitPrice);

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-start rounded-xl border p-4 text-left transition-all ease-expo duration-200",
        active
          ? "border-accent bg-surface-hover shadow-[0_4px_24px_rgba(0,0,0,0.25)]"
          : "border-border bg-surface-2 hover:border-white/25 hover:bg-surface-hover",
      )}
    >
      {/* Radio Button Visual */}
      <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border border-border">
        {active && <div className="h-2.5 w-2.5 rounded-full bg-accent" />}
      </div>

      <span className="text-xs font-medium uppercase tracking-wide text-muted pr-6">
        {label}
      </span>
      <span className="mt-0.5 text-xs text-muted">{qty} unidades</span>

      <span className="mt-3 text-xl font-bold tabular-nums text-accent">
        {formatCordobas(unitPrice)}
      </span>
      <span className="text-xs text-muted line-through">
        {formatCordobas(basePrice)}
      </span>

      {saved > 0 ? (
        <span className="mt-2 rounded-full bg-accent-2/10 px-2 py-0.5 text-[11px] font-bold text-accent-2">
          Ahorras {formatCordobas(saved)} c/u
        </span>
      ) : (
        <span className="mt-2 rounded-full px-2 py-0.5 text-[11px] font-medium text-transparent">
          Precio normal
        </span>
      )}
    </motion.button>
  );
}
