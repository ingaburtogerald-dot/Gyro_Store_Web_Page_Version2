// KPIs de Ventas — esclavos de los datos de la tabla del tab activo.
//
// Recibe la MISMA lista de ventas que renderiza la tabla (ya filtrada por fecha,
// vendedor y estado del tab) y calcula los totales internamente. Así los números
// de las tarjetas coinciden EXACTAMENTE con lo que el usuario ve en la tabla.
//
// Las etiquetas y la última tarjeta son contextuales al estado:
//   - pending  → "(Pendiente)" + "Ventas en Revisión" (conteo de tickets).
//   - approved → "(Aprobado)"  + "Total de Ventas Aprobadas".
//
// Al cambiar de tab, el grid se remonta (key=status) → los números vuelven a
// animar su count-up y la tarjeta entra con fade/slide (sin salto brusco).
import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag, PiggyBank, Coins, Landmark, Clock, CheckCircle2 } from "lucide-react";
import { StatCard } from "~/components/ui/StatCard";
import type { Sale } from "~/store/api/salesApi";
import { formatCordobas, usdFromCordobas } from "~/lib/utils";

export interface KpiTotals {
  totalVendido: number;
  inversion: number;
  comisiones: number;
  ganancia: number;
}

interface SalesKpisProps {
  /** Lista de ventas del tab activo (la misma que muestra la tabla). */
  sales: Sale[];
  status: "pending" | "approved";
  /** Cantidad de tickets del estado (para la tarjeta de conteo). */
  ticketCount: number;
  /**
   * Totales precalculados que TIENEN prioridad sobre la suma de `sales`. Se usan
   * en Aprobadas para reflejar TODO el período (vía summary del servidor) en vez de
   * solo la página visible. Si se omite, se suma `sales` (caso Pendientes).
   */
  overrideTotals?: KpiTotals;
}

export function SalesKpis({ sales, status, ticketCount, overrideTotals }: SalesKpisProps) {
  const totals = useMemo<KpiTotals>(() => {
    if (overrideTotals) return overrideTotals;
    let totalVendido = 0;
    let inversion = 0;
    let comisiones = 0;
    let ganancia = 0;
    for (const s of sales) {
      totalVendido += s.saleTotal || 0;
      inversion += s.costReal ?? s.totalCostReal ?? 0;
      comisiones += s.comisionVendedor || 0;
      ganancia += s.gananciaTienda || 0;
    }
    return { totalVendido, inversion, comisiones, ganancia };
  }, [sales, overrideTotals]);

  const isPending = status === "pending";
  const suf = isPending ? "(Pendiente)" : "(Aprobado)";
  const sufPlural = isPending ? "(Pendientes)" : "(Aprobadas)";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      >
        <StatCard
          icon={ShoppingBag}
          label={`Total Vendido ${suf}`}
          countTo={totals.totalVendido}
          format={formatCordobas}
          sub={usdFromCordobas(totals.totalVendido)}
          color="indigo"
          delay={0}
        />
        <StatCard
          icon={PiggyBank}
          label={`Inversión ${suf}`}
          countTo={totals.inversion}
          format={formatCordobas}
          sub={usdFromCordobas(totals.inversion)}
          color="neutral"
          delay={0.05}
        />
        <StatCard
          icon={Coins}
          label={`Comisiones ${sufPlural}`}
          countTo={totals.comisiones}
          format={formatCordobas}
          sub={usdFromCordobas(totals.comisiones)}
          color="neutral"
          delay={0.1}
        />
        <StatCard
          icon={Landmark}
          label={`Ganancia ${suf}`}
          countTo={totals.ganancia}
          format={formatCordobas}
          sub={usdFromCordobas(totals.ganancia)}
          color="emerald"
          delay={0.15}
        />
        {isPending ? (
          <StatCard icon={Clock} label="Ventas en Revisión" countTo={ticketCount} color="amber" delay={0.2} />
        ) : (
          <StatCard icon={CheckCircle2} label="Total de Ventas Aprobadas" countTo={ticketCount} color="neutral" delay={0.2} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
