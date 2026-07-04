// KPIs de Ventas (tabs Pendientes/Aprobadas) — esclavos de la lista del tab activo.
//
// Recibe la MISMA lista que la tabla y suma con el dominio (sumKpiTotals), salvo que
// se pasen `overrideTotals` (Aprobadas usa el summary del servidor para reflejar TODO
// el período, no solo la página). Render delegado al <KpiGrid/> compartido.
//
// Al cambiar de tab, el wrapper se remonta (key=status) → los números re-animan su
// count-up y la fila entra con fade/slide.
import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag, PiggyBank, Coins, Landmark, Clock, CheckCircle2 } from "lucide-react";
import type { Sale } from "~/store/api/salesApi";
import { sumKpiTotals, type KpiTotals } from "~/domain/sales/salesCalculations";
import { KpiGrid, type KpiCardSpec } from "~/components/shared/KpiGrid";

export type { KpiTotals }; // re-export para compatibilidad con importadores previos

interface SalesKpisProps {
  /** Lista de ventas del tab activo (la misma que muestra la tabla). */
  sales: Sale[];
  status: "pending" | "approved";
  /** Cantidad de tickets del estado (para la tarjeta de conteo). */
  ticketCount: number;
  /** Totales precalculados con prioridad sobre la suma de `sales` (Aprobadas → summary). */
  overrideTotals?: KpiTotals;
}

export function SalesKpis({ sales, status, ticketCount, overrideTotals }: SalesKpisProps) {
  const totals = useMemo<KpiTotals>(
    () => overrideTotals ?? sumKpiTotals(sales),
    [sales, overrideTotals],
  );

  const isPending = status === "pending";
  const suf = isPending ? "(Pendiente)" : "(Aprobado)";
  const sufPlural = isPending ? "(Pendientes)" : "(Aprobadas)";

  const cards: KpiCardSpec[] = [
    { key: "vendido", icon: ShoppingBag, label: `Total Vendido ${suf}`, value: totals.totalVendido, money: true, color: "indigo" },
    { key: "inversion", icon: PiggyBank, label: `Inversión ${suf}`, value: totals.inversion, money: true, color: "neutral" },
    { key: "comisiones", icon: Coins, label: `Comisiones ${sufPlural}`, value: totals.comisiones, money: true, color: "neutral" },
    { key: "ganancia", icon: Landmark, label: `Ganancia ${suf}`, value: totals.ganancia, money: true, color: "emerald" },
    isPending
      ? { key: "count", icon: Clock, label: "Ventas en Revisión", value: ticketCount, color: "amber" }
      : { key: "count", icon: CheckCircle2, label: "Total de Ventas Aprobadas", value: ticketCount, color: "neutral" },
  ];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <KpiGrid cards={cards} className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" />
      </motion.div>
    </AnimatePresence>
  );
}
