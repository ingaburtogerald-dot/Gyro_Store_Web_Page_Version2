// Tabla de compras (registro China) con badges de estado y acciones según estado:
// En tránsito → Reportar llegada / Eliminar; Pendiente → Aprobar recepción.
import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { PlaneTakeoff, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "~/components/ui/DataTable";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { ArrivalModal } from "./ArrivalModal";
import { EditPurchaseModal } from "./EditPurchaseModal";
import {
  useGetPurchasesQuery,
  useDeletePurchaseMutation,
  type Purchase,
} from "~/store/api/inventoryApi";
import { formatUsd } from "~/lib/utils";

const STATUS_META: Record<Purchase["status"], { label: string; cls: string }> = {
  china: { label: "En tránsito", cls: "bg-sky-500/15 text-sky-300" },
  received: { label: "Recibido", cls: "bg-whatsapp/15 text-whatsapp" },
};

export function PurchasesTable() {
  const { data: purchases = [], isLoading } = useGetPurchasesQuery();
  const [del, { isLoading: deleting }] = useDeletePurchaseMutation();

  const [arrivalFor, setArrivalFor] = useState<Purchase | null>(null);
  const [editFor, setEditFor] = useState<Purchase | null>(null);
  const [deleteFor, setDeleteFor] = useState<Purchase | null>(null);

  async function handleDelete() {
    if (!deleteFor) return;
    try {
      await del(deleteFor.id).unwrap();
      toast.success("Compra eliminada.");
      setDeleteFor(null);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo eliminar.");
    }
  }

  const columns = useMemo<ColumnDef<Purchase, any>[]>(
    () => [
      { accessorKey: "purchaseDate", header: "Fecha" },
      { accessorKey: "lot", header: "Lote" },
      { accessorKey: "code", header: "Código" },
      { accessorKey: "productName", header: "Producto" },
      { accessorKey: "quantity", header: "Cant." },
      { accessorKey: "costUnit", header: "P. Base", cell: (c) => formatUsd(c.getValue(), 4) },
      { accessorKey: "taxUnit", header: "Imp. Unit.", cell: (c) => formatUsd(c.getValue(), 4) },
      { accessorKey: "priceUnit", header: "P. Unit.", cell: (c) => formatUsd(c.getValue(), 4) },
      { accessorKey: "total", header: "Total", cell: (c) => formatUsd(c.getValue()) },
      {
        accessorKey: "status",
        header: "Estado",
        cell: (c) => {
          const m = STATUS_META[c.getValue() as Purchase["status"]];
          return <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${m.cls}`}>{m.label}</span>;
        },
      },
      {
        id: "actions",
        header: "Acciones",
        enableSorting: false,
        cell: ({ row }) => {
          const p = row.original;
          if (p.status === "china") {
            return (
              <div className="flex gap-1.5">
                <button
                  onClick={() => setArrivalFor(p)}
                  className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs hover:text-accent-2"
                >
                  <PlaneTakeoff className="h-3.5 w-3.5" /> Reportar llegada
                </button>
                <button
                  onClick={() => setEditFor(p)}
                  aria-label="Editar"
                  className="rounded-lg p-1.5 text-muted hover:text-accent"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDeleteFor(p)}
                  aria-label="Eliminar"
                  className="rounded-lg p-1.5 text-muted hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          }
          if (p.status === "received") {
            return (
              <div className="flex gap-1.5">
                <button
                  onClick={() => setEditFor(p)}
                  aria-label="Editar"
                  className="rounded-lg p-1.5 text-muted hover:text-accent"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          }
          return <span className="text-xs text-muted">—</span>;
        },
      },
    ],
    [],
  );

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-card border border-border bg-surface" />;
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={purchases}
        searchPlaceholder="Buscar por código, lote, producto…"
        emptyText="Aún no hay compras registradas."
      />
      <ArrivalModal purchase={arrivalFor} onClose={() => setArrivalFor(null)} />
      <EditPurchaseModal purchase={editFor} onClose={() => setEditFor(null)} />
      <Modal open={!!deleteFor} onClose={() => setDeleteFor(null)} title="Eliminar compra">
        <p className="text-sm text-muted">
          ¿Eliminar la compra <strong className="text-text">{deleteFor?.code}</strong>? Esta acción no
          se puede deshacer.
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
    </>
  );
}
