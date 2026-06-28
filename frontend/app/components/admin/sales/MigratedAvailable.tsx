// Inventario migrado DISPONIBLE para vender (solo stock > 0). Vista ligera tipo
// "qué puedo vender": código, nombre, cantidad disponible y precio sugerido.
// Los agotados no se muestran (el endpoint de vendibles ya filtra stock > 0).
import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useGetSellableProductsQuery, type SellableProduct } from "~/store/api/salesApi";
import { formatCordobas } from "~/lib/utils";
import { DataTable } from "~/components/ui/DataTable";

export function MigratedAvailable() {
  const { data: products = [], isLoading } = useGetSellableProductsQuery();

  const migrated = useMemo(
    () => products.filter((p) => p.origin === "migrated" && p.stock > 0),
    [products],
  );

  const columns = useMemo<ColumnDef<SellableProduct, any>[]>(
    () => [
      { accessorKey: "code", header: "Código", sortingFn: "alphanumeric" },
      {
        accessorKey: "name",
        header: "Nombre",
        cell: (c) => (
          <span className="flex items-center gap-2 font-medium text-text">
            {c.getValue()}
            <span className="rounded-pill bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
              Migrado
            </span>
          </span>
        ),
      },
      {
        accessorKey: "stock",
        header: "Cantidad disponible",
        cell: (c) => (
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            {c.getValue()} uds
          </span>
        ),
      },
      {
        accessorKey: "price",
        header: "Precio sugerido (C$)",
        cell: (c) => <span className="font-bold text-whatsapp">{formatCordobas(c.getValue() || 0)}</span>,
      },
    ],
    [],
  );

  return (
    <div className="space-y-4 rounded-card border border-border bg-surface p-4">
      <div>
        <h2 className="text-lg font-bold text-text">Inventario Migrado Disponible</h2>
        <p className="text-xs text-muted">Artículos migrados con stock listo para vender.</p>
      </div>

      <DataTable
        columns={columns}
        data={migrated}
        isLoading={isLoading}
        searchPlaceholder="Buscar migrado por código o nombre…"
        emptyText="No hay inventario migrado disponible."
        initialSorting={[{ id: "code", desc: false }]}
      />
    </div>
  );
}
