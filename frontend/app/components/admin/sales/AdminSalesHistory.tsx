import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Trash2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { SALE_STATUS_META } from "./saleStatus";
import { DataTable } from "~/components/ui/DataTable";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { SaleEditor } from "./SaleEditor";
import { useDeleteSaleMutation, type Sale } from "~/store/api/salesApi";
import { formatCordobas } from "~/lib/utils";

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
  const [del, { isLoading: deleting }] = useDeleteSaleMutation();
  const [deleteFor, setDeleteFor] = useState<Sale | null>(null);
  const [editFor, setEditFor] = useState<Sale | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  async function handleDelete() {
    if (!deleteFor || !deleteReason.trim()) return;
    try {
      await del({ id: deleteFor.id, reason: deleteReason.trim() }).unwrap();
      toast.success("Venta eliminada. Stock devuelto si aplica.");
      setDeleteFor(null);
      setDeleteReason("");
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo eliminar la venta.");
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
        id: "products",
        header: "Productos",
        cell: (c) => {
          const items = c.row.original.items || [];
          return (
            <div className="max-w-[350px] min-w-[200px] text-xs truncate" title={items.map((i: any) => i.name).join(", ")}>
              {items.map((i: any) => i.name).join(", ")}
            </div>
          );
        },
      },
      {
        id: "quantity",
        header: "Cant.",
        cell: (c) => {
          const items = c.row.original.items || [];
          const totalQty = items.reduce((sum: number, it: any) => sum + (it.quantity || 0), 0);
          return <span className="font-mono text-xs">{totalQty}</span>;
        }
      },
      {
        accessorKey: "saleTotal",
        header: "Precio Venta",
        cell: (c) => <span className="font-semibold text-text">{formatCordobas(c.getValue())}</span>,
      },
      {
        accessorKey: "displayCostReal",
        header: "Costo Real",
        cell: (c) => <span className="font-mono text-xs text-muted-foreground">{formatCordobas(c.getValue())}</span>,
      },
      {
        accessorKey: "displayUtilidadBruta",
        header: "Utilidad Bruta",
        cell: (c) => <span className="font-mono text-xs text-muted-foreground">{formatCordobas(c.getValue())}</span>,
      },
      {
        accessorKey: "displayCostosFijos",
        header: "Costos Fijos",
        cell: (c) => (
          <span className="font-mono text-xs text-rose-400">
            {c.getValue() > 0 ? `-${formatCordobas(c.getValue())}` : "—"}
          </span>
        ),
      },
      {
        accessorKey: "displayUtilidadNeta",
        header: "Utilidad Neta",
        cell: (c) => <span className="font-mono text-xs text-text">{formatCordobas(c.getValue())}</span>,
      },
      {
        accessorKey: "displayComisionVendedor",
        header: "Comisión Vendedor",
        cell: (c) => {
          const pct = c.row.original.comisionPercent;
          return (
            <div className="text-xs font-semibold text-emerald-400">
              {formatCordobas(c.getValue())}
              {pct !== undefined && <span className="text-[10px] text-muted ml-0.5">({pct}%)</span>}
            </div>
          );
        },
      },
      {
        accessorKey: "displayGananciaTienda",
        header: "Ganancia Tienda",
        cell: (c) => <span className="font-bold text-whatsapp">{formatCordobas(c.getValue())}</span>,
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
                  className="rounded-pill bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-accent-2 cursor-help"
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
        id: "actions",
        header: "Acciones",
        enableSorting: false,
        cell: (c) => (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setEditFor(c.row.original)}
              className="rounded-lg p-1.5 text-muted hover:text-accent hover:bg-surface-hover"
              title="Editar venta"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDeleteFor(c.row.original)}
              className="rounded-lg p-1.5 text-muted hover:text-red-400 hover:bg-red-500/10"
              title="Eliminar venta"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  const finalSales = useMemo(() => {
    return filteredSales.filter((s) => s.status !== "pending_approval" && s.status !== "rejected");
  }, [filteredSales]);

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-4 gap-4">
        <h2 className="text-lg font-bold text-text">Desglose Detallado de Transacciones</h2>
        {onRegisterSale && (
          <button
            onClick={onRegisterSale}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-accent px-4 py-2 text-sm font-bold text-white transition-all hover:opacity-90 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Registrar Venta</span>
          </button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={finalSales}
        isLoading={isLoading}
        hideSearch={true}
        emptyText="No se encontraron transacciones con los filtros seleccionados."
        initialSorting={[{ id: "createdAt", desc: false }]}
      />

      {onPageChange && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted mt-4 border-t border-border pt-4">
          <span>
            Página {page} de {totalPages} (Total: {totalCount} registros)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40 hover:bg-surface-hover transition-colors font-medium text-xs"
            >
              Anterior
            </button>
            <button
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40 hover:bg-surface-hover transition-colors font-medium text-xs"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {deleteFor && (
        <Modal open={!!deleteFor} onClose={() => { setDeleteFor(null); setDeleteReason(""); }} title="Eliminar venta">
          <div className="space-y-4">
            <p className="text-sm text-muted">
              ¿Eliminar por completo la venta de <strong className="text-text">{deleteFor.sellerName}</strong> por{" "}
              <strong>{formatCordobas(deleteFor.saleTotal)}</strong>?{" "}
              {(deleteFor.status === "approved" || deleteFor.status === "paid")
                ? "Se devolverán al inventario las unidades vendidas."
                : "Se liberará el stock reservado."}{" "}
              Esta acción no se puede deshacer.
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
        <Modal open={!!editFor} onClose={() => setEditFor(null)} title="Editar Venta" maxWidth="max-w-3xl">
          <div className="max-h-[80vh] overflow-y-auto pr-1">
            <SaleEditor sale={editFor} onDone={() => setEditFor(null)} />
          </div>
        </Modal>
      )}
    </div>
  );
}
