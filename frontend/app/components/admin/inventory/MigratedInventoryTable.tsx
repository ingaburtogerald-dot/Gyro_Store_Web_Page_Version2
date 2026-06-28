// Tabla del inventario migrado (histórico). Cada fila lleva el badge "Migrado".
// Solo lectura + borrar; su lógica de venta se definirá después.
import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2, Search, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "~/components/ui/DataTable";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { MigratedInventoryForm } from "./MigratedInventoryForm";
import { AnimatedTabs } from "~/components/ui/AnimatedTabs";
import {
  useGetMigratedInventoryQuery,
  useDeleteMigratedItemMutation,
  type MigratedItem,
} from "~/store/api/inventoryApi";
import { formatUsd, formatCordobas } from "~/lib/utils";

export function MigratedInventoryTable({ onOpenForm, period = "all" }: { onOpenForm?: () => void; period?: string }) {
  const { data: items = [], isLoading } = useGetMigratedInventoryQuery(period);
  const [del, { isLoading: deleting }] = useDeleteMigratedItemMutation();
  const [deleteFor, setDeleteFor] = useState<MigratedItem | null>(null);
  const [editFor, setEditFor] = useState<MigratedItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<MigratedItem | null>(null);
  const [filterTab, setFilterTab] = useState<"in_stock" | "out_of_stock">("in_stock");
  const [globalFilter, setGlobalFilter] = useState("");

  // Orden por código, natural (M-IN1, M-IN2 … M-IN12, no M-IN1, M-IN12, M-IN2).
  const sortedItems = useMemo(() => {
    const filtered = items.filter(a => 
      filterTab === "in_stock" ? (a.stock || 0) > 0 : (a.stock || 0) <= 0
    );
    return filtered.sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
  }, [items, filterTab]);

  async function handleDelete() {
    if (!deleteFor) return;
    try {
      await del(deleteFor.id).unwrap();
      toast.success("Ítem migrado eliminado.");
      setDeleteFor(null);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo eliminar.");
    }
  }

  const columns = useMemo<ColumnDef<MigratedItem, any>[]>(
    () => [
      {
        id: "origin",
        header: "",
        enableSorting: false,
        cell: () => (
          <span className="rounded-pill bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-300">
            Migrado
          </span>
        ),
      },
      { accessorKey: "purchaseDate", header: "Fecha" },
      { accessorKey: "lot", header: "Lote", cell: (c) => c.getValue() || "—" },
      { accessorKey: "code", header: "Código" },
      { accessorKey: "productName", header: "Producto" },
      { 
        accessorKey: "quantity", 
        header: "Compradas",
        cell: (c) => <span className="font-semibold text-emerald-400 bg-emerald-400/15 px-2 py-0.5 rounded-full">{c.getValue()}</span>
      },
      { 
        accessorKey: "quantitySold", 
        header: "Salidas",
        cell: (c) => <span className="font-semibold text-rose-400 bg-rose-400/15 px-2 py-0.5 rounded-full">{c.getValue()}</span>
      },
      { 
        accessorKey: "quantityReserved", 
        header: "Reservas",
        cell: (c) => <span className="font-semibold text-amber-400 bg-amber-400/15 px-2 py-0.5 rounded-full">{c.getValue()}</span>
      },
      { 
        accessorKey: "stock", 
        header: "Stock",
        cell: (c) => <span className="font-bold text-sky-400 bg-sky-400/15 px-2 py-0.5 rounded-full">{c.getValue()}</span>
      },
      { accessorKey: "priceBaseUsd", header: "P. Base", cell: (c) => formatUsd(c.getValue(), 4) },
      { accessorKey: "shippingUnitUsd", header: "Envío Unit.", cell: (c) => formatUsd(c.getValue(), 4) },
      { accessorKey: "priceUnitFinalUsd", header: "P. Unit. Final", cell: (c) => formatUsd(c.getValue(), 4) },
      { id: "preTotalUsd", header: "Pre-Total", cell: ({ row }) => formatUsd((row.original.priceBaseUsd || 0) * (row.original.quantity || 0)) },
      { id: "totalUsd", header: "Total", cell: ({ row }) => formatUsd((row.original.priceUnitFinalUsd || 0) * (row.original.quantity || 0)) },
      { accessorKey: "costRealUnitCordobas", header: "Coste Real Unit.", cell: (c) => formatCordobas(c.getValue()) },
      { accessorKey: "suggestedPrice", header: "P. Sugerido", cell: (c) => formatCordobas(c.getValue()) },
    ],
    [],
  );

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-card border border-border bg-surface" />;
  }

  return (
    <div className="space-y-4">
      {/* Barra de herramientas unificada y sticky */}
      <div className="sticky top-[116px] z-10 -mx-4 bg-bg/90 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          
          <div className="flex items-center gap-2 rounded-pill border border-border bg-surface px-3 py-1.5 sm:w-80">
            <Search className="h-4 w-4 shrink-0 text-muted" />
            <input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Buscar código, lote, producto..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </div>

          <div className="flex items-center gap-3">
            {selectedItem ? (
              <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                <span className="text-sm font-medium text-muted hidden lg:inline mr-2">
                  <strong className="text-text">{selectedItem.code}</strong> seleccionado
                </span>
                <Button
                  variant="ghost"
                  onClick={() => setEditFor(selectedItem)}
                  className="h-8 bg-surface-2 text-xs hover:text-accent"
                >
                  <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setDeleteFor(selectedItem)}
                  className="h-8 bg-surface-2 text-xs text-red-400 hover:bg-red-500/15 hover:text-red-400"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Eliminar
                </Button>
                <div className="h-6 w-px bg-border mx-1 hidden sm:block" />
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 text-muted hover:text-text rounded-full hover:bg-surface-2 transition-colors"
                  title="Cancelar selección"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
                <AnimatedTabs
                  items={[
                    { id: "in_stock", label: "En existencia" },
                    { id: "out_of_stock", label: "Agotados" },
                  ]}
                  value={filterTab}
                  onChange={(id) => { setFilterTab(id as "in_stock" | "out_of_stock"); setSelectedItem(null); }}
                  layoutId="migrated-subtabs"
                  indicatorClassName={filterTab === "out_of_stock" ? "bg-red-500/90" : "bg-gradient-accent"}
                />
                {onOpenForm && (
                  <Button onClick={onOpenForm} className="flex items-center gap-1.5 whitespace-nowrap">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Registrar ítem</span>
                  </Button>
                )}
              </div>
            )}
          </div>
          
        </div>
      </div>



      <DataTable
        columns={columns}
        data={sortedItems}
        searchPlaceholder="Buscar por código, lote, producto…"
        emptyText="Aún no hay inventario migrado registrado."
        onRowClick={(row) => setSelectedItem(selectedItem?.id === row.id ? null : row)}
        selectedRowId={selectedItem?.id}
        hideSearch
        globalFilterValue={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
      />
      <Modal open={!!editFor} onClose={() => setEditFor(null)} title="Editar ítem migrado" maxWidth="max-w-3xl">
        {editFor && <MigratedInventoryForm item={editFor} onDone={() => setEditFor(null)} />}
      </Modal>

      <Modal open={!!deleteFor} onClose={() => setDeleteFor(null)} title="Eliminar ítem migrado">
        <p className="text-sm text-muted">
          ¿Eliminar el ítem migrado <strong className="text-text">{deleteFor?.code}</strong>? Esta
          acción no se puede deshacer.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteFor(null)}>
            Cancelar
          </Button>
          <Button onClick={handleDelete} loading={deleting} className="bg-red-500/90">
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
