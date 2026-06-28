// Tarjeta de KPI reutilizable (dashboards de inventario y reportes).
// Incluye spotlight que sigue el cursor, hover con resorte y count-up opcional.
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { SpotlightCard } from "./SpotlightCard";
import { CountUp } from "./CountUp";

export type StatCardColor = "neutral" | "indigo" | "sky" | "amber" | "emerald" | "rose" | "purple" | "red";

const BASE_CARD = "bg-surface-2/30 border-border hover:border-white/10";

const COLOR_MAP: Record<StatCardColor, {
  card: string;
  icon: string;
  label: string;
  value: string;
}> = {
  neutral: {
    card: `stat-card-neutral ${BASE_CARD}`,
    icon: "stat-card-icon text-muted",
    label: "text-muted/90",
    value: "text-text",
  },
  indigo: {
    card: `stat-card-indigo ${BASE_CARD} hover:border-indigo-500/30`,
    icon: "stat-card-icon text-indigo-400",
    label: "text-muted/90",
    value: "text-indigo-400",
  },
  sky: {
    card: `stat-card-sky ${BASE_CARD} hover:border-sky-500/30`,
    icon: "stat-card-icon text-sky-400",
    label: "text-muted/90",
    value: "text-sky-400",
  },
  amber: {
    card: `stat-card-amber ${BASE_CARD} hover:border-amber-500/30`,
    icon: "stat-card-icon text-amber-400",
    label: "text-muted/90",
    value: "text-amber-400",
  },
  emerald: {
    card: `stat-card-emerald ${BASE_CARD} hover:border-emerald-500/30`,
    icon: "stat-card-icon text-emerald-400",
    label: "text-muted/90",
    value: "text-emerald-400",
  },
  rose: {
    card: `stat-card-rose ${BASE_CARD} hover:border-rose-500/30`,
    icon: "stat-card-icon text-rose-400",
    label: "text-muted/90",
    value: "text-rose-400",
  },
  purple: {
    card: `stat-card-purple ${BASE_CARD} hover:border-purple-500/30`,
    icon: "stat-card-icon text-purple-400",
    label: "text-muted/90",
    value: "text-purple-400",
  },
  red: {
    card: `stat-card-red ${BASE_CARD} hover:border-red-500/30`,
    icon: "stat-card-icon text-red-400",
    label: "text-muted/90",
    value: "text-red-400",
  },
};

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = false,
  color,
  countTo,
  format,
  delay = 0,
}: {
  icon?: LucideIcon;
  label: string;
  value?: string | number;
  sub?: string;
  accent?: boolean;
  color?: StatCardColor;
  /** Si se pasa, el valor cuenta hacia arriba al aparecer (en vez de `value`). */
  countTo?: number;
  /** Formateador para `countTo` (p. ej. formatCordobas). */
  format?: (n: number) => string;
  /** Retraso de entrada (s) para escalonar grillas. */
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const chosenColor = color || (accent ? "indigo" : "neutral");
  const theme = COLOR_MAP[chosenColor];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduce ? undefined : { y: -3 }}
      transition={{ type: "spring", stiffness: 320, damping: 26, delay }}
      className={`stat-card-container rounded-card border transition-colors duration-300 ${theme.card}`}
    >
      <SpotlightCard className="rounded-card p-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`h-4 w-4 ${theme.icon}`} />}
          <span className={`stat-card-label text-xs uppercase tracking-wide font-medium ${theme.label}`}>{label}</span>
        </div>
        <p className={`stat-card-value nums mt-2 font-heading ${sub ? "text-xl" : "text-2xl"} font-bold ${theme.value}`}>
          {countTo !== undefined ? <CountUp value={countTo} format={format} /> : value}
        </p>
        {sub && <p className={`stat-card-value nums mt-0.5 font-heading text-xl font-bold ${theme.value}`}>{sub}</p>}
      </SpotlightCard>
    </motion.div>
  );
}
