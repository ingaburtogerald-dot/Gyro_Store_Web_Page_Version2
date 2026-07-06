// Desempeño de vendedores como Leaderboard: lista enriquecida con ranking (medalla para
// el top 3), barra de progreso relativa al líder y el monto vendido + comisión. Cuenta
// "quién manda y por cuánto" de un vistazo, mejor que un BarChart convencional.
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { cn, formatCordobas } from "~/lib/utils";

const MEDAL = ["text-amber-400", "text-slate-300", "text-orange-400"]; // oro, plata, bronce

export function SellerLeaderboard({ data }: { data: { sellerName: string; totalVendido: number; comisiones?: number }[] }) {
  const rows = [...data].sort((a, b) => b.totalVendido - a.totalVendido);
  const max = rows[0]?.totalVendido || 1;

  return (
    <div className="space-y-2 pt-1">
      {rows.map((row, i) => {
        const pct = (row.totalVendido / max) * 100;
        const top3 = i < 3;
        return (
          <motion.div
            key={row.sellerName + i}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.06 * i }}
            className="group relative flex items-center gap-3 rounded-xl border border-transparent p-2.5 transition-colors hover:border-border hover:bg-surface-2/50"
          >
            {/* Rank */}
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums",
                top3 ? "bg-surface-2" : "text-muted",
              )}
            >
              {top3 ? <Trophy className={cn("h-4 w-4", MEDAL[i])} /> : i + 1}
            </div>

            {/* Nombre + barra */}
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-text">{row.sellerName}</span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-text">{formatCordobas(row.totalVendido)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-pill bg-surface-2">
                  <motion.div
                    className="h-full rounded-pill bg-gradient-accent"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.12 + i * 0.06 }}
                  />
                </div>
                {row.comisiones != null && (
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    Comisión <span className="font-medium text-accent-2">{formatCordobas(row.comisiones)}</span>
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
