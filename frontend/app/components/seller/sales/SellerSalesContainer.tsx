// Container "Mis ventas" del vendedor. Presentacional: consume useSellerSales y usa
// el <Pagination/> compartido (mismo control que las vistas de admin). Reemplaza a
// SellerMySales con el estándar de capas. El dinero y los KPIs viven en el tab Resumen.
//
// UX: la acción primaria "Registrar venta" es SIEMPRE alcanzable — CTA en la
// cabecera (escritorio) + FAB (móvil, en AdminSales) + botón en el empty state.
import { motion, useReducedMotion } from "framer-motion";
import { Plus, ShoppingBag } from "lucide-react";
import { SaleCard } from "~/components/admin/sales/SaleCard";
import { SaleDetailModal } from "~/components/admin/sales/SaleDetailModal";
import { Pagination } from "~/components/shared/sales/Pagination";
import { StaggerList, StaggerItem } from "~/components/ui/Motion";
import { CardGridSkeleton } from "~/components/ui/Skeleton";
import { useSellerSales, type SellerStatusFilter } from "~/hooks/sales/useSellerSales";
import { cn } from "~/lib/utils";

const STATUS_CHIPS: { id: SellerStatusFilter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "pending_approval", label: "Pendientes" },
  { id: "paid", label: "Pagadas" },
  { id: "rejected", label: "Rechazadas" },
];

// Tratamiento del CTA primario, compartido por cabecera y empty state.
const CTA =
  "ease-expo inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(16,185,129,0.5)] transition duration-300 hover:-translate-y-0.5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function SellerSalesContainer({
  selectedMonth,
  onRegisterSale,
}: {
  selectedMonth: string;
  onRegisterSale?: () => void;
}) {
  const { sales, isLoading, status, setStatus, detail, setDetail, pagination } = useSellerSales(selectedMonth);
  const reduce = useReducedMotion();

  return (
    <div className="space-y-6 pb-24 sm:pb-0">
      {/* ── Cabecera: título + CTA primario (escritorio) ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold tracking-tight text-text">Mis ventas</h2>
          <p className="mt-1 text-sm text-muted">Registra ventas y sigue su aprobación, pago y comisiones.</p>
        </div>
        {onRegisterSale && (
          <button onClick={onRegisterSale} className={cn(CTA, "hidden sm:inline-flex")}>
            <Plus className="h-4 w-4" /> Registrar venta
          </button>
        )}
      </div>

      {/* ── Segmented control (Apple-style): un carril con thumb deslizante ── */}
      <div className="-mx-1 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex gap-1 rounded-pill border border-border bg-surface-2/60 p-1">
          {STATUS_CHIPS.map((c) => {
            const active = status === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setStatus(c.id)}
                className={cn(
                  "relative shrink-0 rounded-pill px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200 active:scale-95",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  active ? "text-text" : "text-muted hover:text-text",
                )}
              >
                {active &&
                  (reduce ? (
                    <span className="absolute inset-0 rounded-pill bg-surface shadow-sm ring-1 ring-white/5" />
                  ) : (
                    <motion.span
                      layoutId="sellerStatusChip"
                      className="absolute inset-0 rounded-pill bg-surface shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)] ring-1 ring-white/5"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  ))}
                <span className="relative z-10">{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <CardGridSkeleton count={6} />
      ) : sales.length === 0 ? (
        <EmptyState status={status} onRegisterSale={onRegisterSale} />
      ) : (
        <StaggerList key={status} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sales.map((s) => (
            <StaggerItem key={s.id}>
              <SaleCard sale={s} onClick={() => setDetail(s)} />
            </StaggerItem>
          ))}
        </StaggerList>
      )}

      <Pagination {...pagination} />

      <SaleDetailModal sale={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

/** Empty state de alta gama: ícono grande y suave + guía + CTA contextual. */
function EmptyState({
  status,
  onRegisterSale,
}: {
  status: SellerStatusFilter;
  onRegisterSale?: () => void;
}) {
  const filtered = status !== "all";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center gap-5 rounded-card border border-dashed border-border/70 bg-surface/40 px-6 py-16 text-center"
    >
      {/* Ícono grande con halo suave */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-accent/20 blur-2xl" aria-hidden />
        <div className="relative grid h-20 w-20 place-items-center rounded-full bg-accent/10 text-accent-2">
          <ShoppingBag className="h-9 w-9" strokeWidth={1.5} />
        </div>
      </div>

      <div className="space-y-1.5">
        <h3 className="font-heading text-lg font-semibold text-text">
          {filtered ? "Sin ventas en este estado" : "Aún no tienes ventas"}
        </h3>
        <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted">
          {filtered
            ? "Prueba con otro filtro, o registra una nueva venta para este período."
            : "Registra tu primera venta y empieza a construir tu historial y tus comisiones."}
        </p>
      </div>

      {onRegisterSale && (
        <button onClick={onRegisterSale} className={CTA}>
          <Plus className="h-4 w-4" />
          {filtered ? "Registrar una venta" : "Registrar tu primera venta"}
        </button>
      )}
    </motion.div>
  );
}
