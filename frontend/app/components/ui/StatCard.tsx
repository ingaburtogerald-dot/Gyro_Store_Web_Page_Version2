// Tarjeta de KPI reutilizable (dashboards de inventario y reportes).
// Incluye spotlight que sigue el cursor, hover con resorte y count-up opcional.
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { SpotlightCard } from "./SpotlightCard";
import { CountUp } from "./CountUp";

export type StatCardColor = "neutral" | "indigo" | "sky" | "amber" | "emerald" | "rose" | "purple" | "red";

const COLOR_MAP: Record<StatCardColor, {
  card: string;
  icon: string;
  label: string;
  value: string;
}> = {
  neutral: {
    card: "stat-card-neutral bg-surface border-border hover:border-muted/30",
    icon: "stat-card-icon text-muted",
    label: "text-muted/90",
    value: "text-text",
  },
  indigo: {
    card: "stat-card-indigo bg-gradient-to-br from-[#16162a] to-[#20224d] border-indigo-500/20 hover:border-indigo-500/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03),0_4px_24px_rgba(99,102,241,0.06)]",
    icon: "stat-card-icon text-indigo-400",
    label: "text-indigo-300/80",
    value: "text-white font-bold",
  },
  sky: {
    card: "stat-card-sky bg-gradient-to-br from-[#0f1c2b] to-[#122e4c] border-sky-500/20 hover:border-sky-500/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03),0_4px_24px_rgba(14,165,233,0.06)]",
    icon: "stat-card-icon text-sky-400",
    label: "text-sky-300/80",
    value: "text-white font-bold",
  },
  amber: {
    card: "stat-card-amber bg-gradient-to-br from-[#221a10] to-[#402a14] border-amber-500/20 hover:border-amber-500/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03),0_4px_24px_rgba(245,158,11,0.06)]",
    icon: "stat-card-icon text-amber-400",
    label: "text-amber-300/80",
    value: "text-white font-bold",
  },
  emerald: {
    card: "stat-card-emerald bg-gradient-to-br from-[#0a2318] to-[#123f26] border-emerald-500/20 hover:border-emerald-500/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03),0_4px_24px_rgba(16,185,129,0.06)]",
    icon: "stat-card-icon text-emerald-400",
    label: "text-emerald-300/80",
    value: "text-white font-bold",
  },
  rose: {
    card: "stat-card-rose bg-gradient-to-br from-[#241217] to-[#471a25] border-rose-500/20 hover:border-rose-500/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03),0_4px_24px_rgba(244,63,94,0.06)]",
    icon: "stat-card-icon text-rose-400",
    label: "text-rose-300/80",
    value: "text-white font-bold",
  },
  purple: {
    card: "stat-card-purple bg-gradient-to-br from-[#1c122c] to-[#361a59] border-purple-500/20 hover:border-purple-500/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03),0_4px_24px_rgba(168,85,247,0.06)]",
    icon: "stat-card-icon text-purple-400",
    label: "text-purple-300/80",
    value: "text-white font-bold",
  },
  red: {
    card: "stat-card-red bg-gradient-to-br from-[#2c1212] to-[#4c1616] border-red-500/20 hover:border-red-500/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.03),0_4px_24px_rgba(239,68,68,0.06)]",
    icon: "stat-card-icon text-red-400",
    label: "text-red-300/80",
    value: "text-white font-bold",
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
