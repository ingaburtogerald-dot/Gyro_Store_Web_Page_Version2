// Actividad reciente: últimas ventas (cualquier estado) con los filtros globales.
// Se auto-fetchea; muestra skeleton elegante en carga y estado vacío amable.
import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, ArrowUpRight } from "lucide-react";
import { useGetSalesPaginatedQuery, type Sale, type SaleStatus } from "~/store/api/salesApi";
import { formatCordobas } from "~/lib/utils";
import { StatusBadge, type BadgeStatus } from "~/components/ui/StatusBadge";
import { useSalesDashboard } from "./useSalesDashboard";
import { WidgetShell, WidgetRowsSkeleton } from "./WidgetShell";

// Mismo tono que el resto del admin (antes "Pagada" era índigo solo aquí).
const STATUS_META: Record<SaleStatus, { label: string; status: BadgeStatus }> = {
  pending_approval: { label: "Pendiente", status: "pending" },
  approved: { label: "Aprobada", status: "success" },
  paid: { label: "Pagada", status: "whatsapp" },
  rejected: { label: "Rechazada", status: "error" },
};

const RECENT_LIMIT = 6;

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} d`;
}

export function RecentActivityWidget() {
  const { filters } = useSalesDashboard();
  const { data, isLoading } = useGetSalesPaginatedQuery({
    page: 1,
    limit: RECENT_LIMIT,
    sellerEmail: filters.seller,
    date: filters.date,
  });

  const recent = useMemo<Sale[]>(() => {
    return [...(data?.data ?? [])]
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      .slice(0, RECENT_LIMIT);
  }, [data]);

  return (
    <WidgetShell title="Actividad reciente" icon={Activity} tone="emerald">
      {isLoading && !data ? (
        <WidgetRowsSkeleton rows={5} />
      ) : recent.length === 0 ? (
        <div className="flex h-full min-h-32 flex-col items-center justify-center text-center">
          <p className="text-sm text-muted">Sin ventas en este período.</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <ul className="space-y-1">
            {recent.map((sale, i) => {
              const meta = STATUS_META[sale.status];
              return (
                <motion.li
                  key={sale.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ delay: i * 0.04 }}
                  className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2/40"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-surface-2 text-xs font-semibold text-text">
                    {initials(sale.sellerName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{sale.sellerName}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      <StatusBadge status={meta.status} label={meta.label} />
                      <span>{relativeTime(sale.createdAt)}</span>
                    </p>
                  </div>
                  <span className="nums shrink-0 text-sm font-semibold text-text">
                    {formatCordobas(sale.saleTotal)}
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                </motion.li>
              );
            })}
          </ul>
        </AnimatePresence>
      )}
    </WidgetShell>
  );
}
