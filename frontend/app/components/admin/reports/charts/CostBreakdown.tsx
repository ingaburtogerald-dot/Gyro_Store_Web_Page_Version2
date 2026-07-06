// Desglose de costos fijos como barras horizontales HTML (no PieChart): ordenado de
// mayor a menor, con el % que representa cada rubro sobre el total. Más limpio y legible
// que un donut. Entrada escalonada de las filas con Framer Motion.
import { motion } from "framer-motion";
import { formatCordobas } from "~/lib/utils";
import { COLORS } from "./chartPrimitives";

const LABELS: Record<string, string> = {
  publicidad: "Publicidad",
  servicios: "Servicios básicos",
  utiles: "Útiles",
  garantias: "Garantías",
  varios: "Varios",
};
const pretty = (k: string) => LABELS[k] ?? k.charAt(0).toUpperCase() + k.slice(1);

export function CostBreakdown({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const rows = [...data].sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-3.5 pt-1">
      {rows.map((row, i) => {
        const pct = total > 0 ? (row.value / total) * 100 : 0;
        const color = COLORS[i % COLORS.length];
        return (
          <div key={row.name} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 truncate">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}66` }} />
                <span className="truncate font-medium text-text">{pretty(row.name)}</span>
              </div>
              <div className="shrink-0 tabular-nums">
                <span className="font-semibold text-text">{formatCordobas(row.value)}</span>
                <span className="ml-2 text-xs text-muted">{pct.toFixed(0)}%</span>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-pill bg-surface-2">
              <motion.div
                className="h-full rounded-pill"
                style={{ background: `linear-gradient(90deg, ${color}99, ${color})` }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.1 + i * 0.06 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
