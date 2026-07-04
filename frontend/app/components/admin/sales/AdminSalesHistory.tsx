import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Trash2, Pencil, Plus, ChevronLeft, ChevronRight, Search, X, Eye } from "lucide-react";
import { toast } from "sonner";
import { SALE_STATUS_META } from "./saleStatus";
import { DataTable } from "~/components/ui/DataTable";
import { AdminSaleCard } from "./AdminSaleCard";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { SaleEditor } from "./SaleEditor";
import { SaleFinancialsDetail } from "./SaleFinancialsDetail";
import { useDeleteSaleMutation, type Sale } from "~/store/api/salesApi";
import { formatCordobas } from "~/lib/utils";
import { MoneyCell, CodeCell, BreakdownCell } from "~/components/ui/cells";
import { groupSaleItems } from "~/domain/sales/salesCalculations";

interface AdminSalesHistoryProps {
  filteredSales: any[];
  isLoading: boolean;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  totalCount?: number;
  onRegisterSale?: () => void;
}

export function AdminSalesHistory({
  filteredSales,
  isLoading,
  page = 1,
  totalPages = 1,
  onPageChange,
  totalCount = 0,
  onRegisterSale,
}: AdminSalesHistoryProps) {
  const [deleteFor, setDeleteFor] = useState<Sale[] | null>(null);
  const [editFor, setEditFor] = useState<Sale | null>(null);
  const [detailFor, setDetailFor] = useState<Sale | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());
  const [nameQuery, setNameQuery] = useState("");
  const [del, { isLoading: deleting }] = useDeleteSaleMutation();

  async function handleDelete() {
    if (!deleteFor || !deleteReason.trim()) return;
    try {
      await Promise.all(deleteFor.map(s => del({ id: s.id, reason: deleteReason.trim() }).unwrap()));
      toast.success(deleteFor.length > 1 ? "Ventas eliminadas exitosamente." : "Venta eliminada exitosamente.");
      setDeleteFor(null);
      setDeleteReason("");
      setSelectedSales(new Set());
    } catch (err: any) {
      toast.error(err?.data?.error || "Error al eliminar.");
    }
  }

  const columns = useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "Fecha",
        cell: (c) => (c.getValue() ? new Date(c.getValue()).toLocaleDateString("es-NI") : "—"),
      },
      {
        accessorKey: "sellerName",
        header: "Vendedor",
        cell: (c) => <span className="font-semibold text-text">{c.getValue()}</span>,
      },
      {
        id: "code",
        header: "Código",
        cell: (c) => {
          const grouped = groupSaleItems(c.row.original.items || []);
          return (
            <div className="flex flex-col gap-[2px]">
              {grouped.map((it: any, idx: number) => (
                <div key={idx}><CodeCell value={it.code} /></div>
              ))}
            </div>
          );
        },
      },
      {
        id: "products",
        header: "Productos",
        cell: (c) => {
          const grouped = groupSaleItems(c.row.original.items || []);
          return (
            <div className="flex flex-col gap-[2px] max-w-[350px] min-w-[200px] text-xs">
              {grouped.map((it: any, idx: number) => {
                const variant = it.variantName && it.variantName !== "Estándar" ? ` (${it.variantName})` : "";
                return (
                  <div key={idx} className="truncate text-muted" title={`${it.name}${variant}`}>
                    {it.name}{variant}
                  </div>
                );
              })}
            </div>
          );
        },
      },
      {
        id: "quantity",
        header: "Cant.",
        meta: { align: "right" },
        cell: (c) => {
          const grouped = groupSaleItems(c.row.original.items || []);
          return <BreakdownCell items={grouped} isQuantity />;
        }
      },
      {
        accessorKey: "saleTotal",
        header: "Precio Venta",
        meta: { align: "right" },
        cell: (c) => {
          const grouped = groupSaleItems(c.row.original.items || []);
          return <BreakdownCell items={grouped} itemKey="lineTotal" tone="strong" />;
        }
      },
      {
        accessorKey: "displayCostReal",
        header: "Costo Real",
        meta: { align: "right" },
        cell: (c) => <MoneyCell value={c.getValue()} tone="muted" />,
      },
      {
        id: "inversionRecuperada",
        header: "Inversión Recuperada",
        meta: { align: "right" },
        cell: (c) => {
          const s = c.row.original;
          return <MoneyCell value={(s.saleTotal || 0) - (s.displayCostReal || 0)} tone="pos" />;
        },
      },
      {
        accessorKey: "displayUtilidadBruta",
        header: "Utilidad Bruta",
        meta: { align: "right" },
        cell: (c) => <MoneyCell value={c.getValue()} tone="muted" />,
      },
      {
        accessorKey: "displayCostosFijos",
        header: "Costos Fijos",
        meta: { align: "right" },
        cell: (c) =>
          c.getValue() > 0 ? <MoneyCell value={c.getValue()} tone="neg" negative /> : <span className="text-muted">—</span>,
      },
      {
        accessorKey: "displayUtilidadNeta",
        header: "Utilidad Neta",
        meta: { align: "right" },
        cell: (c) => <MoneyCell value={c.getValue()} tone="strong" />,
      },
      {
        accessorKey: "displayComisionVendedor",
        header: "Comisión Vendedor",
        meta: { align: "right" },
        cell: (c) => {
          const pct = c.row.original.comisionPercent;
          return (
            <span className="nums font-semibold text-emerald-400">
              {formatCordobas(c.getValue())}
              {pct !== undefined && <span className="ml-0.5 text-[11px] font-normal text-muted">({pct}%)</span>}
            </span>
          );
        },
      },
      {
        accessorKey: "displayGananciaTienda",
        header: "Ganancia Tienda",
        meta: { align: "right" },
        cell: (c) => <span className="nums font-bold text-whatsapp">{formatCordobas(c.getValue())}</span>,
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: (c) => {
          const s = c.row.original;
          const m = SALE_STATUS_META[s.status as Sale["status"]];
          return (
            <div className="flex flex-col gap-1 items-start">
              <span className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${m.cls}`}>{m.label}</span>
              {s.editReason && (
                <span
                  className="rounded-pill bg-accent/20 px-1.5 py-0.5 text-[11px] font-bold text-accent-2 cursor-help"
                  title={`Editada: ${s.editReason}`}
                >
                  Editada
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "detalle",
        header: "",
        cell: (c) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDetailFor(c.row.original);
            }}
            className="rounded-lg p-1.5 text-muted hover:text-accent-2 hover:bg-accent/10 transition-colors"
            title="Ver desglose financiero"
          >
            <Eye className="h-4 w-4" />
          </button>
        ),
        size: 40,
      },
    ],
    []
  );

  const finalSales = useMemo(() => {
    return filteredSales.filter((s) => s.status !== "pending_approval" && s.status !== "rejected");
  }, [filteredSales]);

  // Búsqueda por nombre (o código) de los productos vendidos en cada transacción.
  const displayedSales = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    if (!q) return finalSales;
    return finalSales.filter((s) =>
      (s.items || []).some((it: any) =>
        (it.name || "").toLowerCase().includes(q) || (it.code || "").toLowerCase().includes(q),
      ),
    );
  }, [finalSales, nameQuery]);

  const totals = useMemo(() => {
    let venta = 0, comision = 0, ganancia = 0;
    for (const s of displayedSales) {
      venta += s.saleTotal || 0;
      comision += s.displayComisionVendedor || s.comisionVendedor || 0;
      ganancia += s.displayGananciaTienda || s.gananciaTienda || 0;
    }
    return { venta, comision, ganancia };
  }, [displayedSales]);

  return (
    <div className="rounded-card border border-border bg-surface p-4 relative">
      <div className="sticky top-0 z-30 flex flex-col lg:flex-row items-start justify-between gap-4 bg-surface pb-2">
        <h2 className="text-lg font-bold text-text">Desglose Detallado de Transacciones</h2>
        <div className="flex flex-wrap items-center gap-3">
          {/* Búsqueda por nombre del producto vendido */}
          <div className="flex items-center gap-2 rounded-pill border border-border bg-surface-2 px-3 w-full sm:w-64">
            <Search className="h-4 w-4 shrink-0 text-muted" />
            <input
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Buscar producto vendido…"
              className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted"
            />
            {nameQuery && (
              <button onClick={() => setNameQuery("")} aria-label="Limpiar" className="shrink-0 text-muted hover:text-text">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {displayedSales.length > 0 && (
            <div className="flex items-center gap-4 rounded-lg border border-border bg-surface-2 px-4 py-2 text-xs shadow-sm">
              <div className="flex flex-col">
                <span className="text-[11px] text-muted uppercase font-bold tracking-wider">Venta Total</span>
                <span className="text-sm font-semibold text-text">{formatCordobas(totals.venta)}</span>
              </div>
              <div className="flex flex-col border-l border-border pl-4">
                <span className="text-[11px] text-muted uppercase font-bold tracking-wider">Comisión</span>
                <span className="text-sm font-semibold text-emerald-400">{formatCordobas(totals.comision)}</span>
              </div>
              <div className="flex flex-col border-l border-border pl-4">
                <span className="text-[11px] text-muted uppercase font-bold tracking-wider">Ganancia</span>
                <span className="text-sm font-bold text-whatsapp">{formatCordobas(totals.ganancia)}</span>
              </div>
            </div>
          )}
          {onPageChange && totalPages > 1 && (
            <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 px-2 py-2 text-xs shadow-sm h-full">
              <span className="text-muted font-bold px-2 whitespace-nowrap">
                Pág. {page}/{totalPages}
              </span>
              <button
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded p-1 text-muted hover:text-text hover:bg-surface-hover disabled:opacity-40 transition-colors"
                title="Página Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="rounded p-1 text-muted hover:text-text hover:bg-surface-hover disabled:opacity-40 transition-colors"
                title="Página Siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          {onRegisterSale && (
            <button
              onClick={onRegisterSale}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-accent px-4 py-2 text-sm font-bold text-white transition-all hover:opacity-90 whitespace-nowrap shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]"
            >
              <Plus className="h-4 w-4" />
              <span>Registrar Venta</span>
            </button>
          )}
        </div>
      </div>
      
      {selectedSales.size > 0 && (
        <div className="sticky bottom-0 z-30 mt-4 rounded-card border border-accent/20 bg-accent/5 p-4 shadow-lg backdrop-blur-sm animate-in slide-in-from-bottom-2 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
              {selectedSales.size}
            </span>
            <span className="text-sm font-semibold text-accent-2">
              {selectedSales.size === 1 ? "Venta seleccionada" : "Ventas seleccionadas"}
            </span>
          </div>
          <div className="flex gap-2">
            {selectedSales.size === 1 && (
              <Button variant="outline" size="sm" onClick={() => {
                const sale = finalSales.find(p => p.id === Array.from(selectedSales)[0]);
                if (sale) setEditFor(sale);
              }}>
                <Pencil className="mr-1.5 h-4 w-4" />
                Editar
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                const sales = finalSales.filter(p => selectedSales.has(p.id));
                setDeleteFor(sales);
              }}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Eliminar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedSales(new Set())}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={displayedSales}
        isLoading={isLoading}
        hideSearch={true}
        emptyText={nameQuery ? `Sin transacciones que incluyan «${nameQuery}».` : "No se encontraron transacciones con los filtros seleccionados."}
        onRowClick={(row) => {
          setSelectedSales((prev) => {
            const next = new Set(prev);
            if (next.has(row.id)) next.delete(row.id);
            else next.add(row.id);
            return next;
          });
        }}
        selectedRowIds={selectedSales}
        onSelectAll={(select) => {
          if (select) setSelectedSales(new Set(displayedSales.map(p => p.id)));
          else setSelectedSales(new Set());
        }}
        allSelected={displayedSales.length > 0 && selectedSales.size === displayedSales.length}
        initialSorting={[{ id: "createdAt", desc: false }]}
        mobileCard={(s) => <AdminSaleCard sale={s} />}
      />

      {deleteFor && (
        <Modal open={!!deleteFor} onClose={() => { setDeleteFor(null); setDeleteReason(""); }} title="Eliminar venta">
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {deleteFor.length === 1 ? (
                <>¿Eliminar por completo la venta de <strong className="text-text">{deleteFor[0].sellerName}</strong> por <strong>{formatCordobas(deleteFor[0].saleTotal)}</strong>? Se devolverán al inventario las unidades vendidas. Esta acción no se puede deshacer.</>
              ) : (
                <>¿Eliminar por completo las <strong>{deleteFor.length} ventas</strong> seleccionadas? Se devolverán al inventario las unidades vendidas de todas ellas. Esta acción no se puede deshacer.</>
              )}
            </p>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-muted">Motivo de la eliminación (obligatorio)</span>
              <textarea
                className="input"
                rows={3}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Indica por qué se elimina esta venta (queda en auditoría)…"
              />
            </label>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="ghost" size="sm" onClick={() => { setDeleteFor(null); setDeleteReason(""); }}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleDelete}
                loading={deleting}
                disabled={!deleteReason.trim()}
                className="bg-red-500/90 hover:bg-red-500"
              >
                Eliminar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {editFor && (
        <Modal open={!!editFor} onClose={() => setEditFor(null)} title="Editar Venta" maxWidth="max-w-7xl">
          <div className="max-h-[80vh] overflow-y-auto pr-1">
            <SaleEditor sale={editFor} onDone={() => { setEditFor(null); setSelectedSales(new Set()); }} />
          </div>
        </Modal>
      )}

      <SaleFinancialsDetail sale={detailFor} onClose={() => setDetailFor(null)} />
    </div>
  );
}
