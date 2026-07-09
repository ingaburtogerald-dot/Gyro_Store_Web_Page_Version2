// Reportería de ventas: tabla continua estilo Excel con todas las ventas
// aprobadas/pagadas en una sola tabla, ordenadas por fecha descendente.
// Respeta los filtros de fecha y vendedor del shell padre.
import { useMemo, useState } from "react";
import { useSearchParams } from "@remix-run/react";
import { Search, X, Eye } from "lucide-react";
import { cn, formatCordobas } from "~/lib/utils";
import { useGetSalesPaginatedQuery, type Sale } from "~/store/api/salesApi";
import { SaleFinancialsDetail } from "./SaleFinancialsDetail";
import { groupSaleItems } from "~/domain/sales/salesCalculations";

interface Props {
  selectedSeller: string;
  selectedDate: string;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-NI");
}

export function SalesReportTable({ selectedSeller, selectedDate }: Props) {
  const [searchParams] = useSearchParams();
  const search = searchParams.get("search") || "";
  const { data: raw, isLoading } = useGetSalesPaginatedQuery(
    { page: 1, limit: 100000, status: "history", sellerEmail: selectedSeller, date: selectedDate },
  );

  const [detailFor, setDetailFor] = useState<Sale | null>(null);

  // Normalizar los campos financieros (mismo patrón que AdminSalesHistory)
  const sales = useMemo(() =>
    (raw?.data ?? []).map((s) => ({
      ...s,
      displayCostReal: s.costReal ?? s.totalCostReal ?? 0,
      displayUtilidadBruta: s.utilidadBruta ?? s.totalUtilidadBruta ?? 0,
      displayCostosFijos: s.costosFijos ?? s.totalCostosFijos ?? 0,
      displayUtilidadNeta: s.utilidadNeta ?? s.totalUtilidadNeta ?? 0,
      displayComisionVendedor: s.comisionVendedor ?? 0,
      displayGananciaTienda: s.gananciaTienda ?? 0,
    })).filter((s) => s.status !== "pending_approval" && s.status !== "rejected"),
  [raw]);

  // Búsqueda por nombre/código del producto
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) =>
      (s.sellerName || "").toLowerCase().includes(q) ||
      (s.items || []).some((it: any) =>
        (it.name || "").toLowerCase().includes(q) || (it.code || "").toLowerCase().includes(q),
      ),
    );
  }, [sales, search]);

  // Ordenar por fecha ascendente (de abajo hacia arriba, las primeras fechas primero)
  const sorted = useMemo(() =>
    [...filtered].sort((a, b) => {
      const da = a.createdAt || "";
      const db = b.createdAt || "";
      return da.localeCompare(db);
    }),
  [filtered]);

  // Totales generales
  const grandTotals = useMemo(() => {
    let vendido = 0, costo = 0, comision = 0, ganancia = 0, count = 0, qty = 0;
    for (const s of sorted) {
      vendido += s.saleTotal || 0;
      costo += s.displayCostReal || 0;
      comision += s.displayComisionVendedor || 0;
      ganancia += s.displayGananciaTienda || 0;
      count += 1;
      for (const it of s.items || []) {
        qty += it.quantity || 0;
      }
    }
    return { vendido, costo, comision, ganancia, count, qty };
  }, [sorted]);

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-card border border-border bg-surface shadow-premium" />;
  }

  return (
    <div className="space-y-5">
      {/* ── Header con resumen general ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold tracking-tight text-text">
            Reportería de Ventas
          </h2>
          <p className="text-sm text-muted">
            Desglose de ventas aprobadas y pagadas.
          </p>
        </div>
      </div>

      {/* ── Resumen general sticky ── */}
      {sorted.length > 0 && (
        <div className="sticky top-28 z-30 grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-surface/90 p-3 shadow-premium backdrop-blur sm:grid-cols-5">
          <SummaryCell label="Ventas" value={String(grandTotals.count)} />
          <SummaryCell label="Total Vendido" value={formatCordobas(grandTotals.vendido)} />
          <SummaryCell label="Costo Real" value={formatCordobas(grandTotals.costo)} muted />
          <SummaryCell label="Comisión" value={formatCordobas(grandTotals.comision)} color="emerald" />
          <SummaryCell label="Ganancia Tienda" value={formatCordobas(grandTotals.ganancia)} color="whatsapp" bold />
        </div>
      )}

      {/* ── Tabla continua tipo Excel ── */}
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted">
          {search
            ? `Sin ventas que incluyan «${search}».`
            : "No se encontraron ventas para el período seleccionado."}
        </div>
      ) : (
        <div className="max-h-[70vh] overflow-auto relative rounded-xl border border-border bg-surface shadow-premium">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="border-b border-border bg-surface-2/80 text-left text-[11px] font-semibold uppercase tracking-wider text-muted backdrop-blur">
                <th className="whitespace-nowrap px-4 py-3">Fecha</th>
                <th className="whitespace-nowrap px-4 py-3">Vendedor</th>
                <th className="whitespace-nowrap px-4 py-3">Código</th>
                <th className="whitespace-nowrap px-4 py-3">Productos</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Cant.</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Precio Venta</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Costo Real</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Comisión</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Ganancia</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Estado</th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {sorted.map((s, idx) => (
                <SaleRow
                  key={s.id}
                  sale={s}
                  index={idx + 1}
                  onDetail={() => setDetailFor(s)}
                />
              ))}
            </tbody>

          </table>
        </div>
      )}

      <SaleFinancialsDetail sale={detailFor} onClose={() => setDetailFor(null)} />
    </div>
  );
}

// ── Componentes internos ──

function SaleRow({ sale: s, index, onDetail }: { sale: any; index: number; onDetail: () => void }) {
  const grouped = groupSaleItems(s.items || []);
  const totalQty = grouped.reduce((a: number, it: any) => a + (it.quantity || 0), 0);
  const statusLabel = s.status === "paid" ? "Pagada" : s.status === "approved" ? "Aprobada" : s.status;
  const statusColor = s.status === "paid" ? "text-accent-2 bg-accent/10" : "text-info bg-info/10";

  return (
    <>
      {grouped.map((it: any, idx: number) => {
        const variant = it.variantName && it.variantName !== "Estándar" ? ` (${it.variantName})` : "";
        const bgClass = index % 2 === 0 ? "bg-surface-2/20" : "";
        const isFirst = idx === 0;
        
        // Fallbacks for legacy sales without item-level financials
        const qty = it.quantity || 1;
        const itemLineTotal = it.lineTotal ?? (it.salePrice ? it.salePrice * qty : (s.saleTotal * (qty / totalQty) || 0));
        const itemCostReal = it.costReal ?? (it.unitCostReal ? it.unitCostReal * qty : ((s.displayCostReal || 0) * (qty / totalQty) || 0));
        const itemComision = it.comisionVendedor ?? (it.unitComisionVendedor ? it.unitComisionVendedor * qty : ((s.displayComisionVendedor || 0) * (qty / totalQty) || 0));
        const itemGanancia = it.gananciaTienda ?? (it.unitGananciaTienda ? it.unitGananciaTienda * qty : ((s.displayGananciaTienda || 0) * (qty / totalQty) || 0));

        // Note: We use a standard top border for all rows after the first
        const borderClass = idx === 0 ? "" : "border-t border-border/20";

        return (
          <tr key={idx} className={cn("group transition-colors hover:bg-surface-2/40", bgClass)}>
            {/* Fecha */}
            <td className={cn("whitespace-nowrap px-4 py-2.5 text-text align-middle", borderClass)}>
              <span>
                {fmtDate(s.createdAt)}
              </span>
            </td>
            {/* Vendedor */}
            <td className={cn("whitespace-nowrap px-4 py-2.5 align-middle", borderClass)}>
              <span className="font-semibold text-text">
                {s.sellerName}
              </span>
            </td>
            
            {/* Código */}
            <td className={cn("px-4 py-2.5", borderClass)}>
              <div className="w-max rounded border border-border/80 bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
                {it.code}
              </div>
            </td>
            {/* Productos */}
            <td className={cn("max-w-[280px] px-4 py-2.5", borderClass)}>
              <div className="flex items-center text-xs">
                <span className="truncate text-text" title={`${it.name}${variant}`}>
                  {it.name}{variant}
                </span>
              </div>
            </td>
            {/* Cantidad */}
            <td className={cn("whitespace-nowrap px-4 py-2.5 text-right tabular-nums", borderClass)}>
              {qty}
            </td>
            {/* Precio Venta */}
            <td className={cn("whitespace-nowrap px-4 py-2.5 text-right tabular-nums font-semibold text-text", borderClass)}>
              {formatCordobas(itemLineTotal)}
            </td>
            {/* Costo Real */}
            <td className={cn("whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-muted", borderClass)}>
              {formatCordobas(itemCostReal)}
            </td>
            {/* Comisión */}
            <td className={cn("whitespace-nowrap px-4 py-2.5 text-right tabular-nums font-semibold text-accent-2", borderClass)}>
              {formatCordobas(itemComision)}
              {isFirst && s.comisionPercent !== undefined && (
                <span className="ml-0.5 text-[10px] font-normal text-muted">({s.comisionPercent}%)</span>
              )}
            </td>
            {/* Ganancia */}
            <td className={cn("whitespace-nowrap px-4 py-2.5 text-right tabular-nums font-bold text-whatsapp", borderClass)}>
              {formatCordobas(itemGanancia)}
            </td>

            {/* Estado */}
            <td className={cn("whitespace-nowrap px-4 py-2.5 text-right align-middle", borderClass)}>
              <span className={cn("inline-block rounded-pill px-2 py-0.5 text-[10px] font-bold", statusColor)}>
                {statusLabel}
              </span>
            </td>
            {/* Detalle */}
            <td className={cn("px-2 py-2.5 text-right align-middle", borderClass)}>
              <button
                onClick={(e) => { e.stopPropagation(); onDetail(); }}
                className={cn(
                  "rounded-lg p-1.5 text-muted transition-all hover:bg-accent/10 hover:text-accent-2",
                  "opacity-0 group-hover:opacity-100"
                )}
                title="Ver desglose financiero"
              >
                <Eye className="h-4 w-4" />
              </button>
            </td>
          </tr>
        );
      })}
    </>
  );
}

function SummaryCell({
  label,
  value,
  muted,
  color,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  color?: string;
  bold?: boolean;
}) {
  const valueColor = color === "emerald"
    ? "text-accent-2"
    : color === "whatsapp"
      ? "text-whatsapp"
      : muted
        ? "text-muted"
        : "text-text";

  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      <span className={cn("text-sm tabular-nums", valueColor, bold && "font-bold", !bold && "font-semibold")}>
        {value}
      </span>
    </div>
  );
}

