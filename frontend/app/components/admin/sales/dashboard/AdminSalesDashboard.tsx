// ───────────────────────────────────────────────────────────────────────────
// AdminSalesDashboard — vista "Resumen" del módulo de ventas (Bento Grid).
//
// Aditivo: convive con los tabs operativos (Inventario / Ventas / Reportería).
// Es la landing de un vistazo; para "trabajar" (aprobar, pagar, auditar) el usuario
// entra a los tabs operativos vía los enlaces de los widgets.
//
// Arquitectura: este archivo monta el Provider (estado de filtros en URL) y delega
// TODO el render a <DashboardLayout>, que es puramente presentacional. Cada widget
// se auto-fetchea con los filtros del contexto (sin prop-drilling de datos).
// ───────────────────────────────────────────────────────────────────────────
import { motion } from "framer-motion";
import { SlidersHorizontal } from "lucide-react";
import { UnifiedDatePicker } from "~/components/ui/UnifiedDatePicker";
import { FilterSelect } from "~/components/ui/FilterSelect";
import { SalesDashboardProvider, useSalesDashboard } from "./useSalesDashboard";
import { bentoContainer, bentoItem } from "./WidgetShell";
import { SalesKpiWidget } from "./SalesKpiWidget";
import { SalesPerformanceWidget } from "./SalesPerformanceWidget";
import { PendingApprovalsWidget } from "./PendingApprovalsWidget";
import { SellerBalanceWidget } from "./SellerBalanceWidget";
import { RecentActivityWidget } from "./RecentActivityWidget";

/** Barra de filtros compartida — escribe en el contexto, no en props locales. */
function DashboardFilters() {
  const { filters, setDate, setSeller, sellerOptions, isAdmin } = useSalesDashboard();
  return (
    <motion.div
      variants={bentoItem}
      className="glass relative z-40 flex flex-wrap items-end justify-between gap-4 rounded-card p-4"
    >
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-accent-2" />
        <div>
          <h2 className="text-sm font-semibold text-text">Vista general</h2>
          <p className="text-xs text-muted">
            {isAdmin ? "Filtra el resumen por período y vendedor." : "Filtra tu resumen por período."}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-52">
          <span className="mb-1 block text-xs text-muted">Período</span>
          <UnifiedDatePicker value={filters.date} onChange={setDate} align="right" />
        </div>
        {/* El selector de vendedor solo aplica a admin (el vendedor solo se ve a sí mismo). */}
        {isAdmin && (
          <div className="w-full sm:w-52">
            <span className="mb-1 block text-xs text-muted">Vendedor</span>
            <FilterSelect
              value={filters.seller}
              onChange={setSeller}
              options={sellerOptions}
              placeholder="Todos los vendedores"
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Layout presentacional puro: solo compone widgets en el grid Bento. */
function DashboardLayout() {
  const { isAdmin } = useSalesDashboard();
  return (
    <motion.div variants={bentoContainer} initial="hidden" animate="show" className="space-y-4 sm:space-y-6 lg:space-y-8">
      <DashboardFilters />

      {/* Fila 1 — KPIs a todo lo ancho */}
      <SalesKpiWidget />

      {/* Bento principal: 12 columnas en lg, distinto por rol */}
      {isAdmin ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <SalesPerformanceWidget />
          </div>
          <div className="lg:col-span-4">
            <PendingApprovalsWidget />
          </div>
          <div className="lg:col-span-12">
            <RecentActivityWidget />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Gráfico 8 cols + resumen 4 cols (misma proporción que admin) */}
          <div className="lg:col-span-8">
            <SalesPerformanceWidget />
          </div>
          <div className="lg:col-span-4">
            <SellerBalanceWidget />
          </div>
          <div className="lg:col-span-12">
            <RecentActivityWidget />
          </div>
        </div>
      )}
    </motion.div>
  );
}

/** Punto de entrada: basta con <AdminSalesDashboard /> dentro del módulo de ventas. */
export function AdminSalesDashboard() {
  return (
    <SalesDashboardProvider>
      <DashboardLayout />
    </SalesDashboardProvider>
  );
}
