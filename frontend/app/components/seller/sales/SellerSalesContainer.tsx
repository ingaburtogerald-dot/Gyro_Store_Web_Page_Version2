// Container "Mis ventas" del vendedor. Presentacional: consume useSellerSales y usa
// el <Pagination/> compartido (mismo control que las vistas de admin). Reemplaza a
// SellerMySales con el estándar de capas. El dinero y los KPIs viven en el tab Resumen.
import { motion, useReducedMotion } from "framer-motion";
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
  { id: "approved", label: "Aprobadas" },
  { id: "paid", label: "Pagadas" },
  { id: "rejected", label: "Rechazadas" },
];

export function SellerSalesContainer({ selectedMonth }: { selectedMonth: string }) {
  const { sales, isLoading, status, setStatus, detail, setDetail, pagination } = useSellerSales(selectedMonth);
  const reduce = useReducedMotion();

  return (
    <div className="space-y-5 pb-24 sm:pb-0">
      {/* Chips de estado */}
      <div className="flex flex-wrap gap-2">
        {STATUS_CHIPS.map((c) => {
          const active = status === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setStatus(c.id)}
              className={cn(
                "relative rounded-pill border px-3 py-1.5 text-xs font-semibold transition-colors",
                active ? "border-accent-2 text-accent-2" : "border-border text-muted hover:text-text",
              )}
            >
              {active &&
                (reduce ? (
                  <span className="absolute inset-0 rounded-pill bg-accent-2/10" />
                ) : (
                  <motion.span
                    layoutId="sellerStatusChip"
                    className="absolute inset-0 rounded-pill bg-accent-2/10"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                ))}
              <span className="relative z-10">{c.label}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <CardGridSkeleton count={6} />
      ) : sales.length === 0 ? (
        <p className="rounded-card border border-border bg-surface py-10 text-center text-sm text-muted">
          No tienes ventas {status !== "all" ? "con este estado " : ""}para este período.
        </p>
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
