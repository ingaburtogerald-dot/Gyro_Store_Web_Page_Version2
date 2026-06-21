// Portal del vendedor: inventario disponible, próximamente, cotizador/registro de venta e historial de comisiones.
import { useMemo, useState, useEffect } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Coins, Clock, ShoppingBag, Plus, ArrowLeft } from "lucide-react";
import { SaleEditor } from "./SaleEditor";
import { AvailableInventory } from "./AvailableInventory";
import { IncomingInventory } from "./IncomingInventory";
import { SALE_STATUS_META } from "./saleStatus";
import { StatCard } from "~/components/ui/StatCard";
import { DataTable } from "~/components/ui/DataTable";
import { useGetSalesPaginatedQuery, useGetSellerSummaryQuery, type Sale } from "~/store/api/salesApi";
import { formatCordobas, usdFromCordobas, cn } from "~/lib/utils";

type Tab = "available" | "incoming" | "new" | "history";

const TABS: { id: Tab; label: string }[] = [
  { id: "available", label: "Inventario Disponible" },
  { id: "incoming", label: "Próximamente" },
  { id: "history", label: "Historial" },
];

export function SellerSales() {
  const [tab, setTab] = useState<Tab>("available");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [page, setPage] = useState(1);

  const { data: salesData, isLoading: loadingSales } = useGetSalesPaginatedQuery({
    page,
    limit: 50,
    date: selectedMonth,
  });

  const sales = salesData?.data ?? [];

  useEffect(() => {
    setPage(1);
  }, [selectedMonth]);

  const columns = useMemo<ColumnDef<Sale, any>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Fecha",
        cell: (c) => (c.getValue() ? new Date(c.getValue()).toLocaleDateString("es-NI") : "—"),
      },
      { accessorFn: (s) => s.items.map((i) => i.name).join(", "), id: "products", header: "Productos" },
      { accessorKey: "items", header: "Cant.", cell: (c) => {
        const items = c.getValue() as Sale["items"];
        return items.reduce((sum, item) => sum + item.quantity, 0);
      }},
      { accessorKey: "saleTotal", header: "Precio venta", cell: (c) => formatCordobas(c.getValue()) },
      {
        accessorKey: "comisionVendedor",
        header: "Mi comisión",
        cell: (c) => (c.getValue() ? formatCordobas(c.getValue()) : "—"),
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: (c) => {
          const m = SALE_STATUS_META[c.getValue() as Sale["status"]];
          return <span className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${m.cls}`}>{m.label}</span>;
        },
      },
    ],
    [],
  );

  const filteredSales = sales;

  const dynamicSummary = useMemo(() => {
    return {
      ventasAprobadas: salesData?.summary?.ventasAprobadas ?? 0,
      totalVendido: salesData?.summary?.totalVendido ?? 0,
      comisionGanada: salesData?.summary?.comisiones ?? 0,
      enRevision: salesData?.summary?.enRevision ?? 0,
    };
  }, [salesData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Portal de Ventas</h1>
          <p className="text-muted">Gestiona tus ventas, cotizaciones e inventario disponible.</p>
        </div>
        {tab === "new" ? (
          <button
            onClick={() => setTab("available")}
            className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-text"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
        ) : (
          <button
            onClick={() => setTab("new")}
            className="inline-flex items-center gap-2 rounded-pill bg-gradient-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Nueva Venta
          </button>
        )}
      </div>

      {/* KPIs y Filtro de Mes - Visibles arriba de los tabs, excepto al registrar venta */}
      {tab !== "new" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <label className="block w-full sm:w-48">
              <span className="mb-1 block text-xs text-muted">Filtrar por Mes</span>
              <input
                type="month"
                className="input"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={CheckCircle2}
              label="Ventas aprobadas"
              countTo={dynamicSummary.ventasAprobadas}
              delay={0}
            />
            <StatCard
              icon={ShoppingBag}
              label="Total vendido"
              countTo={dynamicSummary.totalVendido}
              format={formatCordobas}
              sub={usdFromCordobas(dynamicSummary.totalVendido)}
              delay={0.05}
            />
            <StatCard
              icon={Coins}
              label="Comisión ganada"
              countTo={dynamicSummary.comisionGanada}
              format={formatCordobas}
              sub={usdFromCordobas(dynamicSummary.comisionGanada)}
              color="emerald"
              delay={0.1}
            />
            <StatCard
              icon={Clock}
              label="En revisión"
              countTo={dynamicSummary.enRevision}
              color="amber"
              delay={0.15}
            />
          </div>
        </div>
      )}

      {tab !== "new" && (
        <div className="flex flex-wrap gap-1 rounded-pill border border-border bg-surface p-1 w-full sm:w-fit">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 rounded-pill px-4 py-2 text-sm font-medium transition-colors sm:flex-none whitespace-nowrap",
                tab === t.id ? "bg-gradient-accent text-white" : "text-muted hover:text-text",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === "available" && <AvailableInventory />}
      {tab === "incoming" && <IncomingInventory />}
      {tab === "new" && <SaleEditor />}

      {tab === "history" && (
        <div className="rounded-card border border-border bg-surface p-4">
          <h2 className="mb-4 text-lg font-bold">Ventas del Mes</h2>
          <DataTable 
            columns={columns} 
            data={filteredSales} 
            isLoading={loadingSales}
            searchPlaceholder="Buscar venta…" 
            emptyText="No tienes ventas registradas para este mes." 
          />

          {salesData && salesData.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted mt-4 border-t border-border pt-4">
              <span>
                Página {page} de {salesData.totalPages} (Total: {salesData.total} registros)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40 hover:bg-surface-hover transition-colors font-medium text-xs"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(salesData.totalPages, p + 1))}
                  disabled={page === salesData.totalPages}
                  className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40 hover:bg-surface-hover transition-colors font-medium text-xs"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

