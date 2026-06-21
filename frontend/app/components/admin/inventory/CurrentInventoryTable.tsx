// Inventario Actual: productos recibidos en bodega con todas las columnas
// calculadas (cantidad = original − vendidos, precios USD y costo real en C$).
import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { DataTable } from "~/components/ui/DataTable";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { EditArrivalModal } from "./EditArrivalModal";
import {
  useGetCurrentInventoryQuery,
  useRevertPurchaseMutation,
  useGetPurchasesQuery,
  type InventoryRow,
  type Purchase,
} from "~/store/api/inventoryApi";
import { formatUsd, formatCordobas } from "~/lib/utils";


export function CurrentInventoryTable() {
  const { data: rows = [], isLoading } = useGetCurrentInventoryQuery();
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
      { accessorKey: "code", header: "Código", sortingFn: "alphanumeric" },
      { accessorKey: "productName", header: "Nombre" },
      { accessorKey: "quantityOriginal", header: "Comprado" },
      {
        accessorKey: "quantitySold",
        header: "Vendido",
        cell: (c) => <span className={c.getValue() > 0 ? "text-amber-400 font-medium" : "text-muted"}>{c.getValue()}</span>
      },
      {
        accessorKey: "quantityReserved",
        header: "Reservado",
        cell: (c) => (
          <span className={c.getValue() > 0 ? "text-yellow-400 font-medium" : "text-muted"}>
            {c.getValue() ?? 0}
          </span>
        ),
      },
      {
        accessorKey: "available",
        header: "Stock",
        cell: (c) => <span className={c.getValue() === 0 ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>{c.getValue()}</span>
      },
      { accessorKey: "priceUnitUsd", header: "P. Unit. (USD)", cell: (c) => formatUsd(c.getValue(), 4) },
      { accessorKey: "shippingUnitUsd", header: "Envío U. (USD)", cell: (c) => formatUsd(c.getValue(), 4) },
      { accessorKey: "priceUnitFinalUsd", header: "P. Final (USD)", cell: (c) => formatUsd(c.getValue(), 4) },
      {
        accessorKey: "costRealCordobas",
        header: "Costo Real (C$)",
        cell: (c) => <span className="text-accent-2">{formatCordobas(c.getValue())}</span>,
      },
      {
        id: "precioSugerido",
        header: "Precio Sugerido",
        cell: ({ row }) => {
          const ps = row.original.suggestedPrice;
          if (!ps) return <span className="text-muted text-xs">—</span>;
          return <span className="text-emerald-400 font-semibold">{formatCordobas(ps)}</span>;
        },
      },
      {
        id: "gananciaEsperada",
        header: "Ganancia Esperada",
        cell: ({ row }) => {
          const costReal = row.original.costRealCordobas || 0;
          const ps = row.original.suggestedPrice;
          if (!ps || !costReal) return <span className="text-muted text-xs">—</span>;
          return <span className="text-accent font-semibold">{formatCordobas(ps - costReal)}</span>;
        },
      },
      {
        id: "actions",
        header: "Acciones",
        enableSorting: false,
        cell: ({ row }) => {
          const rowData = row.original;
          const p = purchases.find((x) => x.id === rowData.id);
          return (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setRevertFor(rowData)}
                className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Descartar llegada
              </button>
              {p && (
                <button
                  onClick={() => setEditFor(p)}
                  aria-label="Editar"
                  className="rounded-lg p-1.5 text-muted hover:text-accent transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [purchases],
  );

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-card border border-border bg-surface" />;
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

