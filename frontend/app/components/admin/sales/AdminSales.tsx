import { useMemo } from "react";
import { useSearchParams } from "@remix-run/react";
import { motion } from "framer-motion";
import { Settings, CheckCircle2, Coins, Clock, ShoppingBag, Landmark, Plus, PiggyBank } from "lucide-react";
import { PendingSales } from "./PendingSales";
import { PaymentHistory } from "./PaymentHistory";
import { SalesPerformance } from "./SalesPerformance";
import { SaleEditor } from "./SaleEditor";
import { AvailableInventory } from "./AvailableInventory";
import { MigratedAvailable } from "./MigratedAvailable";
import { IncomingInventory } from "./IncomingInventory";
import { PricingConfigModal } from "./PricingConfigModal";
import { Modal } from "~/components/ui/Modal";
import { AdminSalesHistory } from "./AdminSalesHistory";
import { SalesKpis } from "./SalesKpis";
import { StatCard } from "~/components/ui/StatCard";
import { AnimatedTabs } from "~/components/ui/AnimatedTabs";
import { UnifiedDatePicker } from "~/components/ui/UnifiedDatePicker";
import { FilterSelect, type FilterSelectOption } from "~/components/ui/FilterSelect";
import { useGetSalesPaginatedQuery } from "~/store/api/salesApi";
import { useGetUsersQuery } from "~/store/api/usersApi";
import { formatCordobas, usdFromCordobas } from "~/lib/utils";

type SectionId = "inventory" | "ventas" | "reporteria";
type SubId =
  | "available" | "migrated" | "incoming"
  | "pending" | "approved"
  | "payments" | "performance";

const SECTIONS: { id: SectionId; label: string; subs: { id: SubId; label: string }[] }[] = [
  {
    id: "inventory",
    label: "Inventario",
    subs: [
      { id: "available", label: "Inventario actual" },
      { id: "migrated", label: "Inventario migrado" },
      { id: "incoming", label: "Próximamente" },
    ],
  },
  {
    id: "ventas",
    label: "Ventas",
    subs: [
      { id: "pending", label: "Ventas pendientes" },
      { id: "approved", label: "Ventas aprobadas" },
    ],
  },
  {
    id: "reporteria",
    label: "Reportería de ventas y pagos",
    subs: [
      { id: "payments", label: "Historial de pagos" },
      { id: "performance", label: "Performance" },
    ],
  },
];

const SECTION_ITEMS = SECTIONS.map((s) => ({ id: s.id, label: s.label }));
const VALID_SECTIONS = SECTIONS.map((s) => s.id);

export function AdminSales() {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Lectura + normalización de params ──
  const rawSection = searchParams.get("section") ?? "";
  const section: SectionId = VALID_SECTIONS.includes(rawSection as SectionId)
    ? (rawSection as SectionId)
    : "inventory";

  const currentSubs = SECTIONS.find((s) => s.id === section)!.subs;
  const validSubIds = currentSubs.map((s) => s.id);
  const rawSub = searchParams.get("sub") ?? "";
  const sub: SubId = validSubIds.includes(rawSub as SubId)
    ? (rawSub as SubId)
    : currentSubs[0].id;

  const selectedDate = searchParams.get("date") || "all";
  const selectedSeller = searchParams.get("seller") || "all";
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const configOpen = searchParams.get("config") === "1";
  const saleOpen = searchParams.get("newSale") === "1";

  function updateParams(updates: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(updates)) {
          if (v === null) next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true },
    );
  }

  function changeSection(id: string) {
    const s = SECTIONS.find((x) => x.id === id)!;
    updateParams({ section: s.id, sub: s.subs[0].id, page: null });
  }

  const inVentas = section === "ventas";
  const inReporteria = section === "reporteria";

  // ── Queries (misma lógica que antes, ahora con params de URL) ──
  const { data: pendingTab, isLoading: loadingPending } = useGetSalesPaginatedQuery(
    { page: 1, limit: 200, status: "pending_approval", sellerEmail: selectedSeller, date: selectedDate },
    { skip: !(inVentas && sub === "pending") },
  );

  const { data: approvedData, isLoading: loadingApproved } = useGetSalesPaginatedQuery(
    { page: 1, limit: 100000, status: "history", sellerEmail: selectedSeller, date: selectedDate },
    { skip: !(inVentas && sub === "approved") },
  );

  const { data: reporteriaData } = useGetSalesPaginatedQuery(
    { page: 1, limit: 50, sellerEmail: selectedSeller, date: selectedDate },
    { skip: !inReporteria },
  );

  const { data: users = [] } = useGetUsersQuery();

  const showPendingDots = section === "ventas" && sub === "pending";
  const { data: pendingData } = useGetSalesPaginatedQuery(
    { page: 1, limit: 200, status: "pending_approval", sellerEmail: "all", date: selectedDate },
    { skip: !showPendingDots },
  );
  const pendingSellerEmails = useMemo(() => {
    const set = new Set<string>();
    (pendingData?.data ?? []).forEach((s) => { if (s.sellerEmail) set.add(s.sellerEmail); });
    return set;
  }, [pendingData]);

  const pendingList = pendingTab?.data ?? [];

  const uniqueSellers = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => {
      if (u.email && u.displayName && (u.roles.includes("seller") || u.roles.includes("admin") || u.roles.includes("global_admin"))) {
        map.set(u.email, u.displayName);
      }
    });
    return Array.from(map.entries()).map(([email, name]) => ({ email, name }));
  }, [users]);

  const sellerOptions = useMemo<FilterSelectOption[]>(() => [
    { value: "all", label: "Todos los vendedores" },
    ...uniqueSellers.map((s) => ({
      value: s.email,
      label: s.name,
      dot: showPendingDots && pendingSellerEmails.has(s.email),
    })),
  ], [uniqueSellers, showPendingDots, pendingSellerEmails]);

  const normalizedSales = useMemo(() =>
    (approvedData?.data ?? []).map((s) => ({
      ...s,
      displayCostReal: s.costReal ?? s.totalCostReal ?? 0,
      displayUtilidadBruta: s.utilidadBruta ?? s.totalUtilidadBruta ?? 0,
      displayCostosFijos: s.costosFijos ?? s.totalCostosFijos ?? 0,
      displayUtilidadNeta: s.utilidadNeta ?? s.totalUtilidadNeta ?? 0,
      displayComisionVendedor: s.comisionVendedor ?? 0,
      displayGananciaTienda: s.gananciaTienda ?? 0,
    })),
  [approvedData]);

  const dynamicSummary = useMemo(() =>
    reporteriaData?.summary ?? {
      ventasAprobadas: 0, totalVendido: 0, comisiones: 0,
      gananciaTienda: 0, inversionRecuperada: 0, enRevision: 0,
    },
  [reporteriaData]);

  return (
    <div className="space-y-6">
      {/* ── Cabecera ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="gradient-text text-2xl font-bold">Gestión de Ventas</h1>
          <p className="text-muted">Aprobaciones, comisiones de vendedores y configuración de precios.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateParams({ newSale: "1" })}
            className="group flex items-center gap-1.5 rounded-lg bg-gradient-accent px-3 py-2 text-xs font-semibold text-white shadow-md shadow-accent/20 transition-all hover:shadow-lg hover:shadow-accent/30"
          >
            <Plus className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5" />
            <span>Nueva venta</span>
          </button>
        </div>
      </div>

      {/* ── Tabs de sección + sub-tab ── */}
      <div className="space-y-3">
        <div className="sticky top-16 z-20 -mx-4 bg-bg/80 px-4 py-2 backdrop-blur md:-mx-6 md:px-6">
          <AnimatedTabs items={SECTION_ITEMS} value={section} onChange={changeSection} layoutId="sales-section" />
        </div>
        <div key={section} className="-mx-1 overflow-x-auto px-1 pb-1">
          <AnimatedTabs
            items={currentSubs}
            value={sub}
            onChange={(id) => updateParams({ sub: id, page: null })}
            layoutId="sales-sub"
          />
        </div>
      </div>

      {/* ── Filtros + KPIs (solo Ventas / Reportería) ── */}
      {section !== "inventory" && (
        <div className="space-y-4">
          <div className="glass relative z-40 flex flex-wrap items-center justify-between gap-4 rounded-card p-4">
            <div>
              <h2 className="text-base font-semibold text-text">Filtros del Historial</h2>
              <p className="text-xs text-muted">Ajusta los criterios para auditar las ventas.</p>
            </div>
            <div className="flex flex-wrap items-end gap-3 w-full sm:w-auto">
              <div className="block w-full sm:w-52">
                <span className="mb-1 block text-xs text-muted">Período de Tiempo</span>
                <UnifiedDatePicker
                  value={selectedDate}
                  onChange={(val) => updateParams({ date: val, page: null })}
                />
              </div>
              <div className="block w-full sm:w-52">
                <span className="mb-1 block text-xs text-muted">Vendedor</span>
                <FilterSelect
                  value={selectedSeller}
                  onChange={(val) => updateParams({ seller: val, page: null })}
                  options={sellerOptions}
                  placeholder="Todos los vendedores"
                  dotTitle="Tiene ventas pendientes de aprobación"
                />
              </div>
            </div>
          </div>

          {inVentas && sub === "pending" && (
            <SalesKpis status="pending" sales={pendingList} ticketCount={pendingTab?.total ?? pendingList.length} />
          )}
          {inVentas && sub === "approved" && (
            <SalesKpis
              status="approved"
              sales={approvedData?.data ?? []}
              ticketCount={approvedData?.summary?.ventasAprobadas ?? 0}
              overrideTotals={
                approvedData?.summary
                  ? {
                      totalVendido: approvedData.summary.totalVendido,
                      inversion: approvedData.summary.inversionRecuperada,
                      comisiones: approvedData.summary.comisiones,
                      ganancia: approvedData.summary.gananciaTienda,
                    }
                  : undefined
              }
            />
          )}

          {inReporteria && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard icon={ShoppingBag} label="Total Vendido" countTo={dynamicSummary.totalVendido} format={formatCordobas} sub={usdFromCordobas(dynamicSummary.totalVendido)} color="indigo" delay={0} />
              <StatCard icon={PiggyBank} label="Inversión Recuperada" countTo={dynamicSummary.inversionRecuperada} format={formatCordobas} sub={usdFromCordobas(dynamicSummary.inversionRecuperada)} color="neutral" delay={0.05} />
              <StatCard icon={Coins} label="Comisiones Vendedor" countTo={dynamicSummary.comisiones} format={formatCordobas} sub={usdFromCordobas(dynamicSummary.comisiones)} color="neutral" delay={0.1} />
              <StatCard icon={Landmark} label="Ganancia Tienda" countTo={dynamicSummary.gananciaTienda} format={formatCordobas} sub={usdFromCordobas(dynamicSummary.gananciaTienda)} color="emerald" delay={0.15} />
              <StatCard icon={CheckCircle2} label="Ventas Aprobadas" countTo={dynamicSummary.ventasAprobadas} color="neutral" delay={0.2} />
              <StatCard icon={Clock} label="Ventas en Revisión" countTo={dynamicSummary.enRevision} color="amber" delay={0.25} />
            </div>
          )}
        </div>
      )}

      {/* ── Contenido del sub-tab activo ── */}
      <motion.div key={sub} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {sub === "available" && <AvailableInventory />}
        {sub === "migrated" && <MigratedAvailable />}
        {sub === "incoming" && <IncomingInventory />}
        {sub === "pending" && (
          <PendingSales
            sales={pendingList}
            isLoading={loadingPending}
            onRegisterSale={() => updateParams({ newSale: "1" })}
          />
        )}
        {sub === "performance" && <SalesPerformance selectedMonth={selectedDate} />}
        {sub === "payments" && <PaymentHistory selectedSeller={selectedSeller} />}
        {sub === "approved" && (
          <AdminSalesHistory
            filteredSales={normalizedSales}
            isLoading={loadingApproved}
            page={page}
            totalPages={approvedData?.totalPages ?? 1}
            onPageChange={(p) => updateParams({ page: String(p) })}
            totalCount={approvedData?.total ?? 0}
            onRegisterSale={() => updateParams({ newSale: "1" })}
          />
        )}
      </motion.div>

      {/* ── Modales ── */}
      {configOpen && (
        <PricingConfigModal
          open={configOpen}
          onClose={() => updateParams({ config: null })}
          initialTab="business"
        />
      )}

      <Modal
        open={saleOpen}
        onClose={() => updateParams({ newSale: null })}
        title="Registrar venta"
        maxWidth="max-w-5xl"
        preventOutsideClose={true}
      >
        <div className="max-h-[80vh] overflow-y-auto pr-1">
          <SaleEditor onDone={() => updateParams({ newSale: null })} />
        </div>
      </Modal>
    </div>
  );
}
