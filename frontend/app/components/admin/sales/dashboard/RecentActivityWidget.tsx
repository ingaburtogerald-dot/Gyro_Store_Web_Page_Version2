// Últimas ventas: feed compacto de las ventas más recientes del período filtrado.
// Cada fila responde "¿qué se vendió y por cuánto?" — el producto es el ancla,
// el monto el número fuerte. El vendedor solo aparece cuando el filtro es "todos"
// (ahí sí diferencia); con un vendedor seleccionado sería ruido repetido.
import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, ShoppingBag } from "lucide-react";
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

// Etiqueta del producto: lo que de verdad distingue una venta de otra.
function productLabel(sale: Sale): string {
  const items = sale.items ?? [];
  if (items.length === 0) return "Venta";
  const first = (items[0] as any).name || "Producto";
  return items.length > 1 ? `${first} +${items.length - 1}` : first;
}

// Reciente en relativo; viejo (≥7 d) en fecha real, para no mentir con "hace 46 d".
function whenLabel(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-NI", { day: "numeric", month: "short" });
}

export function RecentActivityWidget() {
  const { filters } = useSalesDashboard();
  const { data, isLoading } = useGetSalesPaginatedQuery({
    page: 1,
    limit: RECENT_LIMIT,
    sellerEmail: filters.seller,
    date: filters.date,
  });

  // El nombre del vendedor solo suma cuando se ven todos (si no, es ruido repetido).
  const showSeller = filters.seller === "all";

  const recent = useMemo<Sale[]>(() => {
    return [...(data?.data ?? [])]
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      .slice(0, RECENT_LIMIT);
  }, [data]);

  return (
    <WidgetShell title="Últimas ventas" icon={Activity} tone="emerald">
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
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2/40"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-surface-2 text-muted">
                    <ShoppingBag className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text" title={productLabel(sale)}>
                      {productLabel(sale)}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted">
                      <StatusBadge status={meta.status} label={meta.label} />
                      <span aria-hidden>·</span>
                      <span>{whenLabel(sale.createdAt)}</span>
                      {showSeller && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="truncate">{sale.sellerName}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 font-heading text-sm font-semibold tabular-nums text-text">
                    {formatCordobas(sale.saleTotal)}
                  </span>
                </motion.li>
              );
            })}
          </ul>
        </AnimatePresence>
      )}
    </WidgetShell>
  );
}
