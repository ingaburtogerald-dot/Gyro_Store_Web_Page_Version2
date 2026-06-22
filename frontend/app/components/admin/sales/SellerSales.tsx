// Portal del vendedor (mobile-first): estado de su dinero arriba, KPIs, y sus ventas /
// pagos en tarjetas (no tablas). Solo ve datos propios y no confidenciales.
import { useMemo, useState, useEffect } from "react";
import { CheckCircle2, Coins, Clock, ShoppingBag, Plus, ArrowLeft, Wallet } from "lucide-react";
import { SaleEditor } from "./SaleEditor";
import { SellerInventory } from "./SellerInventory";
import { SaleCard } from "./SaleCard";
import { SaleDetailModal } from "./SaleDetailModal";
import { PaymentCard } from "./PaymentCard";
import { StatCard } from "~/components/ui/StatCard";
import {
  useGetSalesPaginatedQuery,
  useGetMyBalanceQuery,
  useGetMyPaymentsQuery,
  type Sale,
  type SaleStatus,
} from "~/store/api/salesApi";
import { formatCordobas, usdFromCordobas, cn } from "~/lib/utils";

type Tab = "ventas" | "pagos" | "inventario" | "new";

const TABS: { id: Tab; label: string }[] = [
  { id: "inventario", label: "Inventario" },
  { id: "ventas", label: "Mis Ventas" },
  { id: "pagos", label: "Pagos" },
];

type StatusFilter = "all" | SaleStatus;
const STATUS_CHIPS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "pending_approval", label: "Pendientes" },
  { id: "approved", label: "Aprobadas" },
  { id: "paid", label: "Pagadas" },
  { id: "rejected", label: "Rechazadas" },
];

export function SellerSales() {
  const [tab, setTab] = useState<Tab>("ventas");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [page, setPage] = useState(1);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);

  const { data: salesData, isLoading: loadingSales } = useGetSalesPaginatedQuery({
    page,
    limit: 50,
    date: selectedMonth,
  });
  const { data: balance } = useGetMyBalanceQuery();
  const { data: payments = [], isLoading: loadingPayments } = useGetMyPaymentsQuery();

  const sales = salesData?.data ?? [];

  useEffect(() => {
    setPage(1);
  }, [selectedMonth]);

  const filteredSales = useMemo(
    () => (statusFilter === "all" ? sales : sales.filter((s: Sale) => s.status === statusFilter)),
    [sales, statusFilter],
  );

  const summary = {
    ventasAprobadas: salesData?.summary?.ventasAprobadas ?? 0,
    totalVendido: salesData?.summary?.totalVendido ?? 0,
    comisionGanada: salesData?.summary?.comisiones ?? 0,
    enRevision: salesData?.summary?.enRevision ?? 0,
  };

  const saldo = balance?.saldo ?? 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Portal de Ventas</h1>
          <p className="text-muted">Gestiona tus ventas, comisiones e inventario.</p>
        </div>
        {tab === "new" ? (
          <button
            onClick={() => setTab("ventas")}
            className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-text"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>
        ) : (
          <button
            onClick={() => setTab("new")}
            className="hidden sm:inline-flex items-center gap-2 rounded-pill bg-gradient-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Nueva Venta
          </button>
        )}
      </div>

      {/* Tabs: siempre arriba, justo bajo el encabezado */}
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

      {/* Inventario: solo la lista, sin dinero/KPIs/FAB */}
      {tab === "inventario" && <SellerInventory />}

      {/* Nueva venta: al cerrar el formulario vuelve a Mis Ventas */}
      {tab === "new" && <SaleEditor onDone={() => setTab("ventas")} />}

      {/* Mis Ventas: aquí sí van el dinero, los KPIs y las ventas */}
      {tab === "ventas" && (
        <div className="space-y-5 pb-24 sm:pb-0">
          {/* Tarjeta protagonista: el dinero */}
          <div className="rounded-card border border-whatsapp/30 bg-whatsapp/5 p-5">
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <Wallet className="h-4 w-4 text-whatsapp" /> Comisión por cobrar
            </span>
            <p className="mt-1 text-4xl font-bold text-whatsapp">{formatCordobas(balance?.comisionPorCobrar ?? 0)}</p>
            <p className="text-xs text-muted">
              de {balance?.ventasPorCobrar ?? 0} venta{(balance?.ventasPorCobrar ?? 0) === 1 ? "" : "s"} aprobada
              {(balance?.ventasPorCobrar ?? 0) === 1 ? "" : "s"}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-surface p-3">
                <span className="block text-xs text-muted">
                  {saldo > 0 ? "Saldo a favor" : saldo < 0 ? "Saldo en contra" : "Saldo"}
                </span>
                <p className={cn("font-bold", saldo > 0 ? "text-emerald-400" : saldo < 0 ? "text-red-400" : "text-text")}>
                  {formatCordobas(Math.abs(saldo))}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-3">
                <span className="block text-xs text-muted">Próximo pago estimado</span>
                <p className="font-bold text-text">{formatCordobas(balance?.proximoPago ?? 0)}</p>
              </div>
            </div>
          </div>

          {/* Filtro de mes + KPIs */}
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
            <StatCard icon={CheckCircle2} label="Ventas aprobadas" countTo={summary.ventasAprobadas} delay={0} />
            <StatCard
              icon={ShoppingBag}
              label="Total vendido"
              countTo={summary.totalVendido}
              format={formatCordobas}
              sub={usdFromCordobas(summary.totalVendido)}
              delay={0.05}
            />
            <StatCard
              icon={Coins}
              label="Comisión ganada"
              countTo={summary.comisionGanada}
              format={formatCordobas}
              sub={usdFromCordobas(summary.comisionGanada)}
              color="emerald"
              delay={0.1}
            />
            <StatCard icon={Clock} label="En revisión" countTo={summary.enRevision} color="amber" delay={0.15} />
          </div>

          {/* Chips de estado: filtran las cards de abajo */}
          <div className="flex flex-wrap gap-2">
            {STATUS_CHIPS.map((c) => (
              <button
                key={c.id}
                onClick={() => setStatusFilter(c.id)}
                className={cn(
                  "rounded-pill border px-3 py-1.5 text-xs font-semibold transition-colors",
                  statusFilter === c.id
                    ? "border-accent-2 bg-accent-2/10 text-accent-2"
                    : "border-border text-muted hover:text-text",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          {loadingSales ? (
            <p className="py-10 text-center text-sm text-muted">Cargando tus ventas…</p>
          ) : filteredSales.length === 0 ? (
            <p className="rounded-card border border-border bg-surface py-10 text-center text-sm text-muted">
              No tienes ventas {statusFilter !== "all" ? "con este estado " : ""}para este mes.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSales.map((s: Sale) => (
                <SaleCard key={s.id} sale={s} onClick={() => setDetailSale(s)} />
              ))}
            </div>
          )}

          {salesData && salesData.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-4 text-sm text-muted">
              <span>
                Página {page} de {salesData.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-hover disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(salesData.totalPages, p + 1))}
                  disabled={page === salesData.totalPages}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-hover disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pagos recibidos: solo los pagos, sin tarjeta de comisión por cobrar */}
      {tab === "pagos" && (
        <div className="space-y-4">
          {loadingPayments ? (
            <p className="py-10 text-center text-sm text-muted">Cargando tus pagos…</p>
          ) : payments.length === 0 ? (
            <p className="rounded-card border border-border bg-surface py-10 text-center text-sm text-muted">
              Aún no has recibido pagos.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {payments.map((p) => (
                <PaymentCard key={p.id} payment={p} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* FAB "Nueva Venta": solo en Mis Ventas y solo móvil (en desktop está en el encabezado) */}
      {tab === "ventas" && (
        <button
          onClick={() => setTab("new")}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-accent text-white shadow-lg shadow-accent/30 transition-transform active:scale-95 sm:hidden"
          aria-label="Nueva venta"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <SaleDetailModal sale={detailSale} onClose={() => setDetailSale(null)} />
    </div>
  );
}
