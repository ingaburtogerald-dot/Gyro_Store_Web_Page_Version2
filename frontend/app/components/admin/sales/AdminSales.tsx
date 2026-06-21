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
import { StatCard } from "~/components/ui/StatCard";
import { AnimatedTabs } from "~/components/ui/AnimatedTabs";
import { DatePicker } from "~/components/ui/DatePicker";
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

  const [dateFilterType, setDateFilterType] = useState<"all" | "day" | "month">(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("adminSales_selectedDate") || "all";
      if (saved === "all") return "all";
      if (saved !== "all" && saved.length === 7) return "month";
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

  const { data: salesData, isLoading: loadingSales } = useGetSalesPaginatedQuery({
    page,
    limit: 50,
    sellerEmail: selectedSeller,
    date: selectedDate,
  });

  const { data: users = [] } = useGetUsersQuery();

  const sales = salesData?.data ?? [];

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

  // Las ventas ya vienen filtradas desde el servidor
  const filteredSales = sales;

  // Normalizar campos financieros
  const normalizedSales = useMemo(() => {
    return filteredSales.map((s) => ({
      ...s,
      displayCostReal: s.costReal ?? s.totalCostReal ?? 0,
      displayUtilidadBruta: s.utilidadBruta ?? s.totalUtilidadBruta ?? 0,
      displayCostosFijos: s.costosFijos ?? s.totalCostosFijos ?? 0,
      displayUtilidadNeta: s.utilidadNeta ?? s.totalUtilidadNeta ?? 0,
      displayComisionVendedor: s.comisionVendedor ?? 0,
      displayGananciaTienda: s.gananciaTienda ?? 0,
    }));
  }, [filteredSales]);

  // Calcular KPIs desde el resumen global del servidor
  const dynamicSummary = useMemo(() => {
    return salesData?.summary ?? {
      ventasAprobadas: 0,
      totalVendido: 0,
      comisiones: 0,
      gananciaTienda: 0,
      inversionRecuperada: 0,
      enRevision: 0,
    };
  }, [salesData]);

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
        <div className="flex flex-wrap items-end justify-between gap-4 rounded-card border border-border bg-surface p-4">
          <div>
            <h2 className="text-base font-semibold text-text">Filtros del Historial</h2>
            <p className="text-xs text-muted">Ajusta los criterios de búsqueda para auditar las ventas.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3 w-full sm:w-auto">
            {/* Tipo de Filtro de Fecha */}
            <label className="block w-full sm:w-36">
              <span className="mb-1 block text-xs text-muted">Período de Tiempo</span>
              <select
                className="input py-2 text-xs"
                value={dateFilterType}
                onChange={(e) => {
                  const val = e.target.value as "all" | "day" | "month";
                  setDateFilterType(val);
                  if (val === "all") setSelectedDate("all");
                }}
              >
                <option value="all">Todo el tiempo</option>
                <option value="day">Día específico</option>
                <option value="month">Mes específico</option>
              </select>
            </label>

            {/* Selector de Fecha */}
            {dateFilterType !== "all" && (
            <label className="block w-full sm:w-64">
              <span className="mb-1 block text-xs text-muted">
                {dateFilterType === "day" ? "Fecha (Día)" : "Fecha (Mes)"}
              </span>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  {dateFilterType === "day" ? (
                    <DatePicker
                      value={selectedDate === "all" ? "" : selectedDate}
                      onChange={(val) => setSelectedDate(val || "all")}
                      placeholder="Seleccionar fecha"
                    />
                  ) : (
                    <input
                      type="month"
                      className="input py-2 text-sm"
                      value={selectedDate === "all" || selectedDate.length > 7 ? "" : selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value || "all")}
                    />
                  )}
                </div>
              </div>
            </label>
            )}

            {/* Selector de Vendedor */}
            <label className="block w-full sm:w-56">
              <span className="mb-1 block text-xs text-muted">Vendedor</span>
              <select
                className="input"
                value={selectedSeller}
                onChange={(e) => setSelectedSeller(e.target.value)}
              >
                <option value="all">Todos los vendedores</option>
                {uniqueSellers.map((s) => (
                  <option key={s.email} value={s.email}>
                    {s.name} ({s.email})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Disciplina de color: neutral por defecto; color solo con significado.
              Indigo = métrica protagonista · Emerald = ganancia · Amber = atención. */}
          <StatCard
            icon={ShoppingBag}
            label="Total Vendido"
            countTo={dynamicSummary.totalVendido}
            format={formatCordobas}
            sub={usdFromCordobas(dynamicSummary.totalVendido)}
            color="indigo"
            delay={0}
          />
          <StatCard
            icon={PiggyBank}
            label="Inversión Recuperada"
            countTo={dynamicSummary.inversionRecuperada}
            format={formatCordobas}
            sub={usdFromCordobas(dynamicSummary.inversionRecuperada)}
            color="neutral"
            delay={0.05}
          />
          <StatCard
            icon={Coins}
            label="Comisiones Vendedor"
            countTo={dynamicSummary.comisiones}
            format={formatCordobas}
            sub={usdFromCordobas(dynamicSummary.comisiones)}
            color="neutral"
            delay={0.1}
          />
          <StatCard
            icon={Landmark}
            label="Ganancia Tienda"
            countTo={dynamicSummary.gananciaTienda}
            format={formatCordobas}
            sub={usdFromCordobas(dynamicSummary.gananciaTienda)}
            color="emerald"
            delay={0.15}
          />
          <StatCard
            icon={CheckCircle2}
            label="Ventas Aprobadas"
            countTo={dynamicSummary.ventasAprobadas}
            color="neutral"
            delay={0.2}
          />
          <StatCard
            icon={Clock}
            label="Ventas en Revisión"
            countTo={dynamicSummary.enRevision}
            color="amber"
            delay={0.25}
          />
        </div>
      </div>
      )}

      {/* Contenido de la sub-pestaña activa */}
      <motion.div key={sub} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {sub === "available" && <AvailableInventory />}
        {sub === "migrated" && <MigratedAvailable />}
        {sub === "incoming" && <IncomingInventory />}
        {sub === "pending" && <PendingSales selectedSeller={selectedSeller} selectedMonth={selectedDate} onRegisterSale={() => setSaleOpen(true)} />}
        {sub === "performance" && <SalesPerformance selectedMonth={selectedDate} />}
        {sub === "payments" && <PaymentHistory selectedSeller={selectedSeller} />}
        {sub === "approved" && (
          <AdminSalesHistory
            filteredSales={normalizedSales}
            isLoading={loadingSales}
            page={page}
            totalPages={salesData?.totalPages ?? 1}
            onPageChange={setPage}
            totalCount={salesData?.total ?? 0}
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
