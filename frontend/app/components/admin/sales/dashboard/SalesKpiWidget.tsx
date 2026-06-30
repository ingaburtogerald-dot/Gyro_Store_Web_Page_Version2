// Fila de KPIs del Bento. Se AUTO-FETCHEA con los filtros globales del dashboard
// (fecha + vendedor) y reusa el StatCard del sistema (count-up + spotlight + spring).
//
// Nota de rendimiento: pedimos limit:1 porque solo nos interesa `summary`, que el
// backend agrega sobre TODO el set filtrado (no sobre la página). Si en algún punto
// el summary pasara a calcularse por página, subir el limit aquí.
import { ShoppingBag, PiggyBank, Coins, Landmark, CheckCircle2, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { StatCard } from "~/components/ui/StatCard";
import { useGetSalesPaginatedQuery } from "~/store/api/salesApi";
import { formatCordobas, usdFromCordobas } from "~/lib/utils";
import { useSalesDashboard } from "./useSalesDashboard";
import { bentoItem, SkeletonLine } from "./WidgetShell";

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

  // Primera carga sin datos → skeleton. Refetch por cambio de filtro → mantenemos
  // los números viejos y solo bajamos opacidad (evita el "salto a cero").
  if (isLoading && !data) return <KpiSkeleton />;

  return (
    <motion.div
      variants={bentoItem}
      animate={{ opacity: isFetching ? 0.55 : 1 }}
      transition={{ duration: 0.2 }}
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      <StatCard
        icon={ShoppingBag}
        label="Total Vendido"
        countTo={s.totalVendido}
        format={formatCordobas}
        sub={usdFromCordobas(s.totalVendido)}
        color="indigo"
        delay={0}
      />
      <StatCard
        icon={Coins}
        label={isAdmin ? "Comisiones Vendedor" : "Comisión Ganada"}
        countTo={s.comisiones}
        format={formatCordobas}
        sub={usdFromCordobas(s.comisiones)}
        color={isAdmin ? "amber" : "emerald"}
        delay={0.05}
      />
      {isAdmin ? (
        <>
          <StatCard
            icon={PiggyBank}
            label="Inversión Recuperada"
            countTo={s.inversionRecuperada}
            format={formatCordobas}
            sub={usdFromCordobas(s.inversionRecuperada)}
            color="neutral"
            delay={0.1}
          />
          <StatCard
            icon={Landmark}
            label="Ganancia Tienda"
            countTo={s.gananciaTienda}
            format={formatCordobas}
            sub={usdFromCordobas(s.gananciaTienda)}
            color="emerald"
            delay={0.15}
          />
        </>
      ) : (
        <>
          <StatCard
            icon={CheckCircle2}
            label="Ventas Aprobadas"
            countTo={s.ventasAprobadas}
            color="neutral"
            delay={0.1}
          />
          <StatCard
            icon={Clock}
            label="En Revisión"
            countTo={s.enRevision}
            color="amber"
            delay={0.15}
          />
        </>
      )}
    </motion.div>
  );
}
