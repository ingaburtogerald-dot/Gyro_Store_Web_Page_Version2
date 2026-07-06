// Primitivos compartidos de las visualizaciones de reportería: tarjeta contenedora
// (con eyebrow de acento + entrada animada) y paleta categórica.
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";

export const COLORS = ["#10b981", "#38bdf8", "#f59e0b", "#a855f7", "#f43f5e", "#64748b"];

// Entrada escalonada de las tarjetas (fade in up con spring).
export const gridVariants = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
export const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 240, damping: 26 } },
};

export function ChartCard({
  title,
  subtitle,
  empty = false,
  emptyText = "Sin datos en este período",
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  empty?: boolean;
  emptyText?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      variants={cardVariants}
      className={cn(
        "group relative break-inside-avoid overflow-hidden rounded-card border border-border bg-surface shadow-premium p-5",
        "transition-all duration-300 hover:border-accent/25 hover:shadow-[0_10px_40px_-12px_rgba(0,0,0,0.5)]",
        className,
      )}
    >
      <div className="divider-fade pointer-events-none absolute inset-x-0 top-0 h-px opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="mb-4 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-text">{title}</h3>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {empty ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-muted">{emptyText}</div>
      ) : (
        children
      )}
    </motion.div>
  );
}
