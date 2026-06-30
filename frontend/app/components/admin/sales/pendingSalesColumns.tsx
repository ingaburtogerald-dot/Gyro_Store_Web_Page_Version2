// ─────────────────────────────────────────────────────────────────────────────
// Configuración de columnas de la tabla de Ventas Pendientes (@tanstack/react-table).
//
// Desacoplado del componente: aquí solo vive la DEFINICIÓN declarativa de columnas.
// Los números salen del dominio (resolveSaleFinancials/totalQuantity), no se calculan
// inline. Las acciones de fila (editar/eliminar) NO van aquí porque en esta vista se
// disparan desde la barra de selección; si se necesitaran por fila, se exportaría una
// factory `createPendingSalesColumns(actions)` y se inyectarían por callback.
// ─────────────────────────────────────────────────────────────────────────────
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle } from "lucide-react";
import type { Sale } from "~/store/api/salesApi";
import { resolveSaleFinancials, totalQuantity } from "~/domain/sales/salesCalculations";
import { formatCordobas } from "~/lib/utils";

const money = (v: number | undefined) =>
  v !== undefined ? formatCordobas(v) : "—";

export const pendingSalesColumns: ColumnDef<Sale>[] = [
  {
    accessorKey: "sellerName",
    header: "Vendedor",
    cell: ({ row }) => (
      <div>
        <div className="font-semibold text-text">{row.original.sellerName}</div>
        {row.original.insufficientStockError && (
          <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-rose-400">
            <AlertTriangle className="h-3 w-3" />
            <span>Stock insuficiente</span>
          </div>
        )}
      </div>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Fecha",
    cell: ({ row }) =>
      row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString("es-NI") : "—",
  },
  {
    id: "code",
    header: "Código",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="text-xs">
        {(row.original.items ?? []).map((it, idx) => (
          <div key={idx} className="font-mono text-muted">{it.code || "—"}</div>
        ))}
      </div>
    ),
  },
  {
    id: "products",
    header: "Producto(s)",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="max-w-[350px] min-w-[200px] text-xs">
        {(row.original.items ?? []).map((it, idx) => {
          const variant = it.variantName && it.variantName !== "Estándar" ? ` (${it.variantName})` : "";
          return (
            <div key={idx} className="truncate text-muted" title={`${it.name}${variant}`}>
              {it.name}{variant}
            </div>
          );
        })}
      </div>
    ),
  },
  {
    id: "quantity",
    header: "Cant.",
    enableSorting: false,
    cell: ({ row }) => <span className="font-mono text-xs">{totalQuantity(row.original)}</span>,
  },
  {
    accessorKey: "saleTotal",
    header: "Precio venta",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="font-semibold text-text">{formatCordobas(row.original.saleTotal)}</span>
    ),
  },
  {
    id: "costoReal",
    header: "Costo real",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted">{money(row.original.totalCostReal)}</span>
    ),
  },
  {
    id: "inversionRecuperada",
    header: "Inversión recuperada",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="font-mono text-xs text-emerald-400">
        {formatCordobas(resolveSaleFinancials(row.original).inversionRecuperada)}
      </span>
    ),
  },
  {
    id: "utilidadBruta",
    header: "Utilidad bruta",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted">{money(row.original.totalUtilidadBruta)}</span>
    ),
  },
  {
    id: "costosFijos",
    header: "Costos fijos",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="font-mono text-xs text-rose-400/90">
        {row.original.totalCostosFijos !== undefined ? `-${formatCordobas(row.original.totalCostosFijos)}` : "—"}
      </span>
    ),
  },
  {
    id: "utilidadNeta",
    header: "Utilidad neta",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="font-semibold text-text">{money(row.original.totalUtilidadNeta)}</span>
    ),
  },
  {
    accessorKey: "comisionVendedor",
    header: "Comisión",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="text-xs font-semibold text-emerald-400">
        {money(row.original.comisionVendedor)}
        {row.original.comisionPercent !== undefined && (
          <span className="ml-0.5 text-[10px] text-muted">({row.original.comisionPercent}%)</span>
        )}
      </div>
    ),
  },
  {
    accessorKey: "gananciaTienda",
    header: "Ganancia tienda",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="font-bold text-whatsapp">{money(row.original.gananciaTienda)}</span>
    ),
  },
];
