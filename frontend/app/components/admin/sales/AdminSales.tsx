import { useState, useMemo, useEffect } from "react";
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

export function AdminSales() {
  const [section, setSection] = useState<SectionId>("inventory");
  const [sub, setSub] = useState<SubId>("available");
  const currentSubs = SECTIONS.find((s) => s.id === section)!.subs;
  function changeSection(id: string) {
    const s = SECTIONS.find((x) => x.id === id)!;
    setSection(s.id);
    setSub(s.subs[0].id);
  }
  const [configOpen, setConfigOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);

  const [selectedDate, setSelectedDate] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("adminSales_selectedDate") || "all";
    }
    return "all";
  });

  const [selectedSeller, setSelectedSeller] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("adminSales_selectedSeller") || "all";
    }
    return "all";
  });

  const [page, setPage] = useState(1);

  const inVentas = section === "ventas";
  const inReporteria = section === "reporteria";

  // Datos del tab "Ventas pendientes": alimentan KPIs Y tabla desde la MISMA fuente.
  const { data: pendingTab, isLoading: loadingPending } = useGetSalesPaginatedQuery(
    { page: 1, limit: 200, status: "pending_approval", sellerEmail: selectedSeller, date: selectedDate },
    { skip: !(inVentas && sub === "pending") },
  );

  // Datos del tab "Ventas aprobadas": KPIs + tabla paginada. status=history → approved+paid.
  const { data: approvedData, isLoading: loadingApproved } = useGetSalesPaginatedQuery(
    { page, limit: 50, status: "history", sellerEmail: selectedSeller, date: selectedDate },
    { skip: !(inVentas && sub === "approved") },
  );

  // Resumen para los KPIs de Reportería (pagos / performance) — comportamiento previo.
  const { data: reporteriaData } = useGetSalesPaginatedQuery(
    { page: 1, limit: 50, sellerEmail: selectedSeller, date: selectedDate },
    { skip: !inReporteria },
  );

  const { data: users = [] } = useGetUsersQuery();

  // Solo en el tab "Ventas pendientes" marcamos con un punto a los vendedores que tienen pendientes.
  const showPendingDots = section === "ventas" && sub === "pending";
  const { data: pendingData } = useGetSalesPaginatedQuery(
    { page: 1, limit: 200, status: "pending_approval", sellerEmail: "all", date: selectedDate },
    { skip: !showPendingDots },
  );
  const pendingSellerEmails = useMemo(() => {
    const set = new Set<string>();
    (pendingData?.data ?? []).forEach((s) => {
      if (s.sellerEmail) set.add(s.sellerEmail);
    });
    return set;
  }, [pendingData]);

  const pendingList = pendingTab?.data ?? [];

  // Guardar en sessionStorage para retener el filtro si el usuario navega a otras partes
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("adminSales_selectedDate", selectedDate);
    }
  }, [selectedDate]);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("adminSales_selectedSeller", selectedSeller);
    }
  }, [selectedSeller]);

  // Resetear página al cambiar filtros
  useEffect(() => {
    setPage(1);
  }, [selectedSeller, selectedDate]);

  // Extraer lista única de vendedores a partir de la API de usuarios
  const uniqueSellers = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => {
      if (u.email && u.displayName && (u.roles.includes("seller") || u.roles.includes("admin") || u.roles.includes("global_admin"))) {
        map.set(u.email, u.displayName);
      }
    });
    return Array.from(map.entries()).map(([email, name]) => ({ email, name }));
  }, [users]);

  // Opciones del filtro de vendedor (con punto indicador de pendientes en el tab correspondiente)
  const sellerOptions = useMemo<FilterSelectOption[]>(() => {
    return [
      { value: "all", label: "Todos los vendedores" },
      ...uniqueSellers.map((s) => ({
        value: s.email,
        label: s.name,
        dot: showPendingDots && pendingSellerEmails.has(s.email),
      })),
    ];
  }, [uniqueSellers, showPendingDots, pendingSellerEmails]);

  // Normalizar campos financieros de las ventas aprobadas (para la tabla del historial).
  const normalizedSales = useMemo(() => {
    return (approvedData?.data ?? []).map((s) => ({
      ...s,
      displayCostReal: s.costReal ?? s.totalCostReal ?? 0,
      displayUtilidadBruta: s.utilidadBruta ?? s.totalUtilidadBruta ?? 0,
      displayCostosFijos: s.costosFijos ?? s.totalCostosFijos ?? 0,
      displayUtilidadNeta: s.utilidadNeta ?? s.totalUtilidadNeta ?? 0,
      displayComisionVendedor: s.comisionVendedor ?? 0,
      displayGananciaTienda: s.gananciaTienda ?? 0,
    }));
  }, [approvedData]);

  // KPIs de Reportería desde el resumen global del servidor.
  const dynamicSummary = useMemo(() => {
    return reporteriaData?.summary ?? {
      ventasAprobadas: 0,
      totalVendido: 0,
      comisiones: 0,
      gananciaTienda: 0,
      inversionRecuperada: 0,
      enRevision: 0,
    };
  }, [reporteriaData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Ventas</h1>
          <p className="text-muted">Aprobaciones, comisiones de vendedores y configuración de precios y costos.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfigOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text transition-all hover:bg-surface-hover whitespace-nowrap"
            title="Configurar Costos Fijos de la Tienda"
          >
            <Settings className="h-4 w-4" />
            <span>Costos Fijos</span>
          </button>
        </div>
      </div>

      {/* Pestañas: sección (Inventario / Ventas / Reportería) + sub-pestaña */}
      <div className="space-y-3">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <AnimatedTabs items={SECTION_ITEMS} value={section} onChange={changeSection} layoutId="sales-section" />
        </div>
        <div key={section} className="-mx-1 overflow-x-auto px-1 pb-1">
          <AnimatedTabs items={currentSubs} value={sub} onChange={(id) => setSub(id as SubId)} layoutId="sales-sub" />
        </div>
      </div>

      {/* Panel de KPIs y Filtros — solo en Ventas / Reportería (no en Inventario) */}
      {section !== "inventory" && (
      <div className="space-y-4">
        <div className="glass relative z-40 flex flex-wrap items-center justify-between gap-4 rounded-card p-4">
          <div>
            <h2 className="text-base font-semibold text-text">Filtros del Historial</h2>
            <p className="text-xs text-muted">Ajusta los criterios para auditar las ventas.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3 w-full sm:w-auto">
            {/* Selector unificado de fecha (mes o día en un solo picker) */}
            <div className="block w-full sm:w-52">
              <span className="mb-1 block text-xs text-muted">Período de Tiempo</span>
              <UnifiedDatePicker
                value={selectedDate}
                onChange={(val) => setSelectedDate(val)}
              />
            </div>

            {/* Selector de Vendedor */}
            <div className="block w-full sm:w-52">
              <span className="mb-1 block text-xs text-muted">Vendedor</span>
              <FilterSelect
                value={selectedSeller}
                onChange={(val) => setSelectedSeller(val)}
                options={sellerOptions}
                placeholder="Todos los vendedores"
                dotTitle="Tiene ventas pendientes de aprobación"
              />
            </div>
          </div>
        </div>

        {/* KPIs de Ventas: esclavos de la lista del tab activo (calculados en SalesKpis). */}
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

        {/* Reportería conserva el resumen global del servidor (pagos / performance). */}
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

      {/* Contenido de la sub-pestaña activa */}
      <motion.div key={sub} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {sub === "available" && <AvailableInventory />}
        {sub === "migrated" && <MigratedAvailable />}
        {sub === "incoming" && <IncomingInventory />}
        {sub === "pending" && <PendingSales sales={pendingList} isLoading={loadingPending} onRegisterSale={() => setSaleOpen(true)} />}
        {sub === "performance" && <SalesPerformance selectedMonth={selectedDate} />}
        {sub === "payments" && <PaymentHistory selectedSeller={selectedSeller} />}
        {sub === "approved" && (
          <AdminSalesHistory
            filteredSales={normalizedSales}
            isLoading={loadingApproved}
            page={page}
            totalPages={approvedData?.totalPages ?? 1}
            onPageChange={setPage}
            totalCount={approvedData?.total ?? 0}
            onRegisterSale={() => setSaleOpen(true)}
          />
        )}
      </motion.div>

      {configOpen && (
        <PricingConfigModal open={configOpen} onClose={() => setConfigOpen(false)} initialTab="business" />
      )}

      <Modal open={saleOpen} onClose={() => setSaleOpen(false)} title="Registrar venta" maxWidth="max-w-5xl" preventOutsideClose={true}>
        <div className="max-h-[80vh] overflow-y-auto pr-1">
          <SaleEditor onDone={() => setSaleOpen(false)} />
        </div>
      </Modal>
    </div>
  );
}
