// "Mis Ventas" del vendedor dentro del shell unificado de ventas.
// Solo la lista (chips de estado + grid + paginación + detalle); el dinero y los
// KPIs viven en el tab Resumen. El backend ya limita los datos al vendedor logueado.
import { useMemo, useState } from "react";
import { useSearchParams } from "@remix-run/react";
import { motion, useReducedMotion } from "framer-motion";
import { SaleCard } from "./SaleCard";
import { SaleDetailModal } from "./SaleDetailModal";
import { StaggerList, StaggerItem } from "~/components/ui/Motion";
import { CardGridSkeleton } from "~/components/ui/Skeleton";
import { useGetSalesPaginatedQuery, type Sale, type SaleStatus } from "~/store/api/salesApi";
import { cn } from "~/lib/utils";

type StatusFilter = "all" | SaleStatus;

const STATUS_CHIPS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "pending_approval", label: "Pendientes" },
  { id: "approved", label: "Aprobadas" },
  { id: "paid", label: "Pagadas" },
  { id: "rejected", label: "Rechazadas" },
];

const VALID_STATUSES = STATUS_CHIPS.map((c) => c.id);

export function SellerMySales({ selectedMonth }: { selectedMonth: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const reduce = useReducedMotion();

  const rawStatus = searchParams.get("status") ?? "";
  const statusFilter: StatusFilter = VALID_STATUSES.includes(rawStatus as StatusFilter)
    ? (rawStatus as StatusFilter)
    : "all";
  const page = Math.max(1, Number(searchParams.get("page") || "1"));

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

  const { data: salesData, isLoading } = useGetSalesPaginatedQuery({
    page,
    limit: 50,
    date: selectedMonth,
  });

  const sales = salesData?.data ?? [];
  const filteredSales = useMemo(
    () => (statusFilter === "all" ? sales : sales.filter((s) => s.status === statusFilter)),
    [sales, statusFilter],
  );

  return (
    <div className="space-y-5 pb-24 sm:pb-0">
      {/* Chips de estado */}
      <div className="flex flex-wrap gap-2">
        {STATUS_CHIPS.map((c) => {
          const active = statusFilter === c.id;
          return (
            <button
              key={c.id}
              onClick={() => updateParams({ status: c.id === "all" ? null : c.id, page: null })}
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
      ) : filteredSales.length === 0 ? (
        <p className="rounded-card border border-border bg-surface py-10 text-center text-sm text-muted">
          No tienes ventas {statusFilter !== "all" ? "con este estado " : ""}para este período.
        </p>
      ) : (
        <StaggerList key={statusFilter} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSales.map((s) => (
            <StaggerItem key={s.id}>
              <SaleCard sale={s} onClick={() => setDetailSale(s)} />
            </StaggerItem>
          ))}
        </StaggerList>
      )}

      {salesData && salesData.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4 text-sm text-muted">
          <span>Página {page} de {salesData.totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => updateParams({ page: String(page - 1) })}
              disabled={page === 1}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-hover disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={() => updateParams({ page: String(page + 1) })}
              disabled={page === salesData.totalPages}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-hover disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      <SaleDetailModal sale={detailSale} onClose={() => setDetailSale(null)} />
    </div>
  );
}
