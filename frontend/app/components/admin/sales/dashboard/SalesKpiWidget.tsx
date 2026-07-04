// Fila de KPIs del Bento. Se AUTO-FETCHEA con los filtros globales del dashboard
// (fecha + vendedor) y delega el render al <KpiGrid/> compartido (estilo + stagger).
//
// Nota de rendimiento: pedimos limit:1 porque solo nos interesa `summary`, que el
// backend agrega sobre TODO el set filtrado (no sobre la página).
import { ShoppingBag, PiggyBank, Coins, Landmark, CheckCircle2, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useGetSalesPaginatedQuery } from "~/store/api/salesApi";
import { useSalesDashboard } from "./useSalesDashboard";
import { bentoItem, SkeletonLine } from "./WidgetShell";
import { KpiGrid, type KpiCardSpec } from "~/components/shared/KpiGrid";

const EMPTY_SUMMARY = {
  ventasAprobadas: 0,
  totalVendido: 0,
  comisiones: 0,
  gananciaTienda: 0,
  inversionRecuperada: 0,
  enRevision: 0,
};

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="glass rounded-card p-4">
          <SkeletonLine className="w-1/2" />
          <SkeletonLine className="mt-3 h-6 w-3/4" />
          <SkeletonLine className="mt-2 h-3 w-1/3 opacity-70" />
        </div>
      ))}
    </div>
  );
}

export function SalesKpiWidget() {
  const { filters, isAdmin } = useSalesDashboard();
  const { data, isLoading, isFetching } = useGetSalesPaginatedQuery({
    page: 1,
    limit: 1,
    sellerEmail: filters.seller,
    date: filters.date,
  });

  const s = data?.summary ?? EMPTY_SUMMARY;

  // Primera carga sin datos → skeleton. Refetch por cambio de filtro → KpiGrid atenúa.
  if (isLoading && !data) return <KpiSkeleton />;

  const cards: KpiCardSpec[] = isAdmin
    ? [
        { key: "vendido", icon: ShoppingBag, label: "Total Vendido", value: s.totalVendido, money: true, color: "indigo" },
        { key: "comision", icon: Coins, label: "Comisiones Vendedor", value: s.comisiones, money: true, color: "amber" },
        { key: "inversion", icon: PiggyBank, label: "Inversión Recuperada", value: s.inversionRecuperada, money: true, color: "neutral" },
        { key: "ganancia", icon: Landmark, label: "Ganancia Tienda", value: s.gananciaTienda, money: true, color: "emerald" },
      ]
    : [
        { key: "vendido", icon: ShoppingBag, label: "Total Vendido", value: s.totalVendido, money: true, color: "indigo" },
        { key: "comision", icon: Coins, label: "Comisión Ganada", value: s.comisiones, money: true, color: "emerald" },
        { key: "aprobadas", icon: CheckCircle2, label: "Ventas Aprobadas", value: s.ventasAprobadas, color: "neutral" },
        { key: "revision", icon: Clock, label: "En Revisión", value: s.enRevision, color: "amber" },
      ];

  return (
    <motion.div variants={bentoItem}>
      <KpiGrid cards={cards} className="grid-cols-2 lg:grid-cols-4" dimmed={isFetching} />
    </motion.div>
  );
}
