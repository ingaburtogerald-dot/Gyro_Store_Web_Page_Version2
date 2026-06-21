import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useGetIncomingInventoryQuery } from "~/store/api/inventoryApi";
import { DataTable } from "~/components/ui/DataTable";

export function IncomingInventory() {
  const { data: incoming = [], isLoading } = useGetIncomingInventoryQuery();

  const columns = useMemo<ColumnDef<any, any>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Código",
      },
      {
        accessorKey: "productName",
        header: "Nombre",
        cell: (c) => <span className="font-medium text-text">{c.getValue()}</span>,
      },
      {
        accessorKey: "quantity",
        header: "Cantidad",
        cell: (c) => <span className="font-semibold">{c.getValue()} uds</span>
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: (c) => {
          const val = c.getValue();
          const label = val === "china" ? "En tránsito" : "Pendiente de aprobación";
          const cls = val === "china" 
            ? "bg-sky-500/10 text-sky-400 border border-sky-500/20" 
            : "bg-amber-500/10 text-amber-400 border border-amber-500/20";
          return (
            <span className={`rounded-pill px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
              {label}
            </span>
          );
        }
      },
      {
        accessorKey: "purchaseDate",
        header: "Fecha estimada",
        cell: (c) => (c.getValue() ? new Date(c.getValue()).toLocaleDateString("es-NI") : "—")
      }
    ],
    []
  );

  return (
    <div className="space-y-4 rounded-card border border-border bg-surface p-4">
      <div>
        <h2 className="text-lg font-bold text-text">Próximamente</h2>
        <p className="text-xs text-muted">Productos en tránsito de China o en espera de recepción.</p>
      </div>

      <DataTable
        columns={columns}
        data={incoming}
        isLoading={isLoading}
        searchPlaceholder="Buscar pedidos en tránsito…"
        emptyText="No hay mercadería próximamente en camino."
        mobileCard={(row) => {
          const label = row.status === "china" ? "En tránsito" : "Pendiente de aprobación";
          const cls =
            row.status === "china"
              ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
              : "bg-amber-500/10 text-amber-400 border border-amber-500/20";
          const date = row.purchaseDate ? new Date(row.purchaseDate).toLocaleDateString("es-NI") : "—";
          return (
            <div className="space-y-2 rounded-card border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted">{row.code}</span>
                  <p className="mt-1 font-medium text-text">{row.productName}</p>
                </div>
                <span className={`shrink-0 rounded-pill px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
                <span className="font-semibold">{row.quantity} uds</span>
                <span className="text-xs text-muted">Estimada: {date}</span>
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
