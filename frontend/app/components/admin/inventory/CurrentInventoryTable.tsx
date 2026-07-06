// Inventario Actual: productos recibidos en bodega con todas las columnas
// calculadas (cantidad = original − vendidos, precios USD y costo real en C$).
import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { DataTable } from "~/components/ui/DataTable";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { RowActionsMenu } from "~/components/ui/RowActionsMenu";
import { EditArrivalModal } from "./EditArrivalModal";
import {
  useGetCurrentInventoryQuery,
  useRevertPurchaseMutation,
  useGetPurchasesQuery,
  type InventoryRow,
  type Purchase,
} from "~/store/api/inventoryApi";
import { formatUsd, formatCordobas } from "~/lib/utils";
import { CodeCell } from "~/components/ui/cells";


export function CurrentInventoryTable({ period = "all" }: { period?: string }) {
  const { data: rows = [], isLoading } = useGetCurrentInventoryQuery(period);
  // Las compras se traen sin filtro de periodo: se usan para resolver el lote
  // detrás de una fila al editar, y ese lote puede ser de cualquier mes.
  const { data: purchases = [] } = useGetPurchasesQuery();
  const [revert] = useRevertPurchaseMutation();

  const [revertFor, setRevertFor] = useState<InventoryRow | null>(null);
  const [editFor, setEditFor] = useState<Purchase | null>(null);
  const [reverting, setReverting] = useState(false);

  async function handleRevert() {
    if (!revertFor) return;
    setReverting(true);
    try {
      await revert(revertFor.id).unwrap();
      toast.success(`La llegada del lote "${revertFor.lot}" ha sido descartada. El producto volvió a estar en tránsito.`);
      setRevertFor(null);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo descartar la llegada.");
    } finally {
      setReverting(false);
    }
  }

  const columns = useMemo<ColumnDef<InventoryRow, any>[]>(
    () => [
      { accessorKey: "code", header: "Código", sortingFn: "alphanumeric", cell: (c) => <CodeCell value={c.getValue()} /> },
      { accessorKey: "productName", header: "Nombre" },
      { accessorKey: "quantityOriginal", header: "Comprado", meta: { align: "right" } },
      {
        accessorKey: "quantitySold",
        header: "Vendido",
        meta: { align: "right" },
        cell: (c) => <span className={c.getValue() > 0 ? "text-amber-400 font-medium" : "text-muted"}>{c.getValue()}</span>
      },
      {
        accessorKey: "quantityReserved",
        header: "Reservado",
        meta: { align: "right" },
        cell: (c) => (
          <span className={c.getValue() > 0 ? "text-yellow-400 font-medium" : "text-muted"}>
            {c.getValue() ?? 0}
          </span>
        ),
      },
      {
        accessorKey: "available",
        header: "Stock",
        meta: { align: "right" },
        cell: (c) => <span className={c.getValue() === 0 ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>{c.getValue()}</span>
      },
      // USD a 2 decimales visibles; la precisión completa (4) queda en el tooltip.
      { accessorKey: "priceUnitUsd", header: "P. Unit. (USD)", meta: { align: "right" }, cell: (c) => <span title={formatUsd(c.getValue(), 4)}>{formatUsd(c.getValue())}</span> },
      { accessorKey: "shippingUnitUsd", header: "Envío U. (USD)", meta: { align: "right" }, cell: (c) => <span title={formatUsd(c.getValue(), 4)}>{formatUsd(c.getValue())}</span> },
      { accessorKey: "priceUnitFinalUsd", header: "P. Final (USD)", meta: { align: "right" }, cell: (c) => <span title={formatUsd(c.getValue(), 4)}>{formatUsd(c.getValue())}</span> },
      {
        accessorKey: "costRealCordobas",
        header: "Costo Real (C$)",
        meta: { align: "right" },
        cell: (c) => <span className="text-accent-2">{formatCordobas(c.getValue())}</span>,
      },
      {
        id: "precioSugerido",
        header: "Precio Sugerido",
        meta: { align: "right" },
        cell: ({ row }) => {
          const ps = row.original.suggestedPrice;
          if (!ps) return <span className="text-muted text-xs">—</span>;
          return <span className="text-emerald-400 font-semibold">{formatCordobas(ps)}</span>;
        },
      },
      {
        id: "gananciaEsperada",
        header: "Ganancia Esperada",
        meta: { align: "right" },
        cell: ({ row }) => {
          const costReal = row.original.costRealCordobas || 0;
          const ps = row.original.suggestedPrice;
          if (!ps || !costReal) return <span className="text-muted text-xs">—</span>;
          return <span className="text-accent font-semibold">{formatCordobas(ps - costReal)}</span>;
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const rowData = row.original;
          const p = purchases.find((x) => x.id === rowData.id);
          return (
            <div className="flex items-center justify-end gap-1.5">
              <button
                onClick={() => setRevertFor(rowData)}
                className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Descartar llegada
              </button>
              {p && (
                <RowActionsMenu actions={[{ label: "Editar", icon: <Pencil className="h-4 w-4" />, onClick: () => setEditFor(p) }]} />
              )}
            </div>
          );
        },
      },
    ],
    [purchases],
  );

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-card border border-border bg-surface shadow-premium" />;
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Buscar en bodega…"
        emptyText="No hay productos recibidos en bodega todavía."
        initialSorting={[{ id: "code", desc: false }]}
      />

      <Modal open={!!revertFor} onClose={() => setRevertFor(null)} title="Descartar Llegada de Lote">
        <div className="space-y-4">
          <p className="text-sm text-muted leading-relaxed">
            ¿Estás seguro de que deseas descartar la llegada del producto{" "}
            <strong className="text-text font-semibold">{revertFor?.productName}</strong> (Lote:{" "}
            <span className="text-accent-2 font-mono font-bold">{revertFor?.lot}</span>)?
          </p>
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3.5 text-xs text-red-400 leading-normal">
            <strong className="block mb-1 text-red-300 font-semibold">⚠️ Advertencia de Inventario:</strong>
            Se restarán <strong className="text-red-300 font-bold">{revertFor?.available} unidades</strong> del stock actual en bodega. El lote completo volverá al estado original de <strong className="text-red-300 font-semibold">"En tránsito"</strong> en el Registro de Compras.
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRevertFor(null)}>
            Cancelar
          </Button>
          <Button onClick={handleRevert} loading={reverting} className="bg-red-500/90 hover:bg-red-600 text-white">
            Confirmar y Descartar
          </Button>
        </div>
      </Modal>

      <EditArrivalModal purchase={editFor} onClose={() => setEditFor(null)} />
    </>
  );
}

