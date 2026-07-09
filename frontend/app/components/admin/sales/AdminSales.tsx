import { useMemo } from "react";
import { useSearchParams } from "@remix-run/react";
import { motion } from "framer-motion";
import { CheckCircle2, Coins, Clock, ShoppingBag, Landmark, Plus, PiggyBank, SlidersHorizontal, Search, X } from "lucide-react";
import { PendingSalesContainer } from "./PendingSalesContainer";
import { PaymentHistory } from "./PaymentHistory";
import { SalesPerformance } from "./SalesPerformance";
import { SalesReportTable } from "./SalesReportTable";
import { SaleEditor } from "./SaleEditor";
import { AvailableInventory } from "./AvailableInventory";
import { MigratedAvailable } from "./MigratedAvailable";
import { IncomingInventory } from "./IncomingInventory";
import { SellerInventory } from "./SellerInventory";
import { SellerSalesContainer } from "~/components/seller/sales/SellerSalesContainer";
import { SellerPayments } from "./SellerPayments";
import { PricingConfigModal } from "./PricingConfigModal";
import { Modal } from "~/components/ui/Modal";
import { AdminSalesHistory } from "./AdminSalesHistory";
import { AdminSalesDashboard } from "./dashboard/AdminSalesDashboard";
import { SalesKpis } from "./SalesKpis";
import { KpiGrid } from "~/components/shared/KpiGrid";
import { AnimatedTabs } from "~/components/ui/AnimatedTabs";
import { UnifiedDatePicker } from "~/components/ui/UnifiedDatePicker";
import { FilterSelect, type FilterSelectOption } from "~/components/ui/FilterSelect";
import { useGetSalesPaginatedQuery } from "~/store/api/salesApi";
import { useGetUsersQuery } from "~/store/api/usersApi";
import { useAppSelector } from "~/store/hooks";
import { selectIsAdmin } from "~/store/slices/authSlice";

type SectionId = "resumen" | "inventory" | "ventas" | "reporteria";
type SubId =
  | "overview"
  | "available" | "migrated" | "incoming"
  | "pending" | "approved" | "mine"
  | "payments" | "sales_report" | "performance";

type Section = { id: SectionId; label: string; subs: { id: SubId; label: string }[] };

// El shell es el mismo para admin y vendedor; cambian las secciones disponibles y
// el contenido de cada una (siempre enfocado a lo que el vendedor hace).
// "Ventas" va de PRIMERO (es la acción central del rol) y es la pestaña por
// defecto. La sub-pestaña "Ventas aprobadas" se retiró de la navegación.
const ADMIN_SECTIONS: Section[] = [
  {
    id: "ventas",
    label: "Ventas",
    subs: [
      { id: "pending", label: "Ventas pendientes" },
    ],
  },
  { id: "resumen", label: "Resumen", subs: [{ id: "overview", label: "Vista general" }] },
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
    id: "reporteria",
    label: "Reportería de ventas y pagos",
    subs: [
      { id: "sales_report", label: "Reportería de ventas" },
      { id: "payments", label: "Historial de pagos" },
      { id: "performance", label: "Performance" },
    ],
  },
];

const SELLER_SECTIONS: Section[] = [
  { id: "ventas", label: "Ventas", subs: [{ id: "mine", label: "Mis ventas" }] },
  { id: "resumen", label: "Resumen", subs: [{ id: "overview", label: "Vista general" }] },
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
    id: "reporteria",
    label: "Reportería de ventas y pagos",
    subs: [
      { id: "sales_report", label: "Mis ventas" },
      { id: "payments", label: "Mis pagos" },
    ],
  },
];

export function AdminSales() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = useAppSelector(selectIsAdmin);

  const SECTIONS = isAdmin ? ADMIN_SECTIONS : SELLER_SECTIONS;
  const SECTION_ITEMS = useMemo(() => SECTIONS.map((s) => ({ id: s.id, label: s.label })), [SECTIONS]);
  const VALID_SECTIONS = useMemo(() => SECTIONS.map((s) => s.id), [SECTIONS]);

  // ── Lectura + normalización de params ──
  const rawSection = searchParams.get("section") ?? "";
  const section: SectionId = VALID_SECTIONS.includes(rawSection as SectionId)
    ? (rawSection as SectionId)
    : VALID_SECTIONS[0]; // "ventas" — primera pestaña y landing por defecto

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

  // ── Queries de admin (skip para vendedor: no aplican o exponen datos ajenos) ──
  const { data: pendingTab, isLoading: loadingPending } = useGetSalesPaginatedQuery(
    { page: 1, limit: 200, status: "pending_approval", sellerEmail: selectedSeller, date: selectedDate },
    { skip: !(isAdmin && inVentas && sub === "pending") },
  );

  const { data: approvedData, isLoading: loadingApproved } = useGetSalesPaginatedQuery(
    { page: 1, limit: 100000, status: "history", sellerEmail: selectedSeller, date: selectedDate },
    { skip: !(isAdmin && inVentas && sub === "approved") },
  );

  const { data: reporteriaData } = useGetSalesPaginatedQuery(
    { page: 1, limit: 50, sellerEmail: selectedSeller, date: selectedDate },
    { skip: !(isAdmin && inReporteria) },
  );

  const { data: users = [] } = useGetUsersQuery(undefined, { skip: !isAdmin });

  const showPendingDots = isAdmin && section === "ventas" && sub === "pending";
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

  // El vendedor filtra por período en Ventas y Reportería (Mis pagos ahora depende de fecha).
  const showSellerDateBar = !isAdmin && (inVentas || inReporteria);

  return (
    <div className="space-y-6">
      {/* ── Cabecera ── */}
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-text sm:text-3xl">
          {isAdmin ? "Gestión de Ventas" : "Portal de Ventas"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {isAdmin
            ? "Aprobaciones, comisiones de vendedores y configuración de precios."
            : "Tus ventas, comisiones, pagos e inventario."}
        </p>
      </div>

      {/* ── Tabs de sección + sub-tab ── */}
      <div className="space-y-3">
        <div className="-mx-4 px-4 md:-mx-6 md:px-6">
          <AnimatedTabs items={SECTION_ITEMS} value={section} onChange={changeSection} layoutId="sales-section" />
        </div>
        {currentSubs.length > 1 && (
          <div key={section} className="-mx-1 overflow-x-auto px-1 pb-1">
            <AnimatedTabs
              items={currentSubs}
              value={sub}
              onChange={(id) => updateParams({ sub: id, page: null })}
              layoutId="sales-sub"
            />
          </div>
        )}
      </div>

      {/* ── Filtros + KPIs de admin (solo Ventas / Reportería) ── */}
      {isAdmin && (inVentas || inReporteria) && (
        <div className="space-y-5">
          {/* ── KPIs (ahora arriba de los filtros) ── */}
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
            <KpiGrid
              featuredKey="ganancia"
              className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
              cards={[
                { key: "ganancia", icon: Landmark, label: "Ganancia Tienda", value: dynamicSummary.gananciaTienda, money: true, color: "emerald" },
                { key: "vendido", icon: ShoppingBag, label: "Total Vendido", value: dynamicSummary.totalVendido, money: true, color: "indigo" },
                { key: "inversion", icon: PiggyBank, label: "Inversión Recuperada", value: dynamicSummary.inversionRecuperada, money: true, color: "neutral" },
                { key: "comisiones", icon: Coins, label: "Comisiones Vendedor", value: dynamicSummary.comisiones, money: true, color: "neutral" },
                { key: "aprobadas", icon: CheckCircle2, label: "Ventas Aprobadas", value: dynamicSummary.ventasAprobadas, color: "neutral" },
                { key: "revision", icon: Clock, label: "Ventas en Revisión", value: dynamicSummary.enRevision, color: "amber" },
              ]}
            />
          )}

          {/* ── Filtros (ahora debajo de los KPIs, justo antes de la tabla) ── */}
          <div className="relative z-40 flex flex-wrap items-center gap-3 border-b border-border/60 pb-4">
            <span className="mr-auto inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted hidden sm:inline-flex">
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
            </span>
            
            {/* ── Búsqueda Global ── */}
            <div className="flex w-full items-center gap-2 rounded-pill border border-border bg-surface-2 px-3 py-1.5 transition-colors focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/20 sm:w-64">
              <Search className="h-4 w-4 shrink-0 text-muted" />
              <input
                value={searchParams.get("search") || ""}
                onChange={(e) => updateParams({ search: e.target.value || null, page: null })}
                placeholder="Buscar producto..."
                className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
              />
              {searchParams.get("search") && (
                <button 
                  onClick={() => updateParams({ search: null, page: null })} 
                  aria-label="Limpiar" 
                  className="shrink-0 text-muted hover:text-text"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="w-full sm:w-48">
              <UnifiedDatePicker
                value={selectedDate}
                onChange={(val) => updateParams({ date: val, page: null })}
              />
            </div>
            <div className="w-full sm:w-52">
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
      )}

      {/* ── Filtro de período del vendedor (Ventas / Reportería) ── */}
      {showSellerDateBar && (
        <div className="relative z-40 flex flex-wrap items-center gap-3 border-b border-border/60 pb-4">
          <span className="mr-auto inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
            <SlidersHorizontal className="h-4 w-4" />
            Período
          </span>
          <div className="w-full sm:w-52">
            <UnifiedDatePicker
              value={selectedDate}
              onChange={(val) => updateParams({ date: val, page: null })}
            />
          </div>
        </div>
      )}

      {/* ── Contenido del sub-tab activo ── */}
      <motion.div key={`${section}-${sub}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {sub === "overview" && <AdminSalesDashboard />}

        {/* Inventario */}
        {sub === "available" && (isAdmin ? <AvailableInventory /> : <SellerInventory />)}
        {sub === "migrated" && <MigratedAvailable />}
        {sub === "incoming" && <IncomingInventory />}

        {/* Ventas */}
        {sub === "pending" && (
          <PendingSalesContainer
            sales={pendingList}
            isLoading={loadingPending}
            onRegisterSale={() => updateParams({ newSale: "1" })}
          />
        )}
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
        {sub === "mine" && (
          <SellerSalesContainer
            selectedMonth={selectedDate}
            onRegisterSale={() => updateParams({ newSale: "1" })}
          />
        )}

        {/* Reportería */}
        {sub === "payments" && (isAdmin ? <PaymentHistory selectedSeller={selectedSeller} selectedDate={selectedDate} /> : <SellerPayments selectedDate={selectedDate} />)}
        {sub === "sales_report" && <SalesReportTable selectedSeller={isAdmin ? selectedSeller : "mine"} selectedDate={selectedDate} />}
        {sub === "performance" && isAdmin && <SalesPerformance selectedMonth={selectedDate} />}
      </motion.div>

      {/* FAB móvil para el vendedor (ergonomía one-thumb en celular). */}
      {!isAdmin && !saleOpen && (
        <motion.button
          onClick={() => updateParams({ newSale: "1" })}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileTap={{ scale: 0.88 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-accent text-white shadow-[0_10px_30px_-8px_rgba(16,185,129,0.6)] sm:hidden"
          aria-label="Nueva venta"
        >
          {/* Halo que respira detrás del FAB (micro-interacción) */}
          <span className="absolute inset-0 -z-10 rounded-full bg-accent/40 blur-md motion-safe:animate-ping [animation-duration:2.5s]" aria-hidden />
          <Plus className="h-6 w-6" />
        </motion.button>
      )}

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
        maxWidth="max-w-7xl"
        preventOutsideClose={true}
      >
        <div className="max-h-[80vh] overflow-y-auto pr-1">
          <SaleEditor onDone={() => updateParams({ newSale: null })} />
        </div>
      </Modal>
    </div>
  );
}
