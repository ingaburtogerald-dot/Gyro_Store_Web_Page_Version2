// ─────────────────────────────────────────────────────────────────────────────
// Configuración de columnas de la tabla de Ventas Pendientes (@tanstack/react-table).
//
// Desacoplado del componente: aquí solo vive la DEFINICIÓN declarativa de columnas.
// Los números salen del dominio (resolveSaleFinancials/totalQuantity), no se calculan
// inline. Las acciones de fila (editar/eliminar) NO van aquí porque en esta vista se
// disparan desde la barra de selección; si se necesitaran por fila, se exportaría una
// factory `createPendingSalesColumns(actions)` y se inyectarían por callback.
//
// Convención tipográfica: dinero con <MoneyCell/> (nums + alineado a la derecha vía
// meta.align); font-mono solo para códigos (<CodeCell/>).
// ─────────────────────────────────────────────────────────────────────────────
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle } from "lucide-react";
import type { Sale } from "~/store/api/salesApi";
import { resolveSaleFinancials, totalQuantity, groupSaleItems } from "~/domain/sales/salesCalculations";
import { formatCordobas } from "~/lib/utils";
import { MoneyCell, CodeCell, BreakdownCell } from "~/components/ui/cells";

export const pendingSalesColumns: ColumnDef<Sale>[] = [
  {
    accessorKey: "sellerName",
    header: "Vendedor",
    cell: ({ row }) => (
      <div>
        <div className="font-semibold text-text">{row.original.sellerName}</div>
        {row.original.insufficientStockError && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-danger">
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
    cell: ({ row }) => {
      const grouped = groupSaleItems(row.original.items ?? []);
      return (
        <div>
          {grouped.map((it, idx) => (
            <div key={idx}><CodeCell value={it.code} /></div>
          ))}
        </div>
      );
    },
  },
  {
    id: "products",
    header: "Producto(s)",
    enableSorting: false,
    cell: ({ row }) => {
      const grouped = groupSaleItems(row.original.items ?? []);
      return (
        <div className="max-w-[350px] min-w-[200px] text-xs">
          {grouped.map((it, idx) => {
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
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => {
          const grouped = groupSaleItems(row.original.items ?? []);
          return <BreakdownCell items={grouped} isQuantity />;
        },
      },
      {
        accessorKey: "saleTotal",
        header: "Precio venta",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => {
          const grouped = groupSaleItems(row.original.items ?? []);
          return <BreakdownCell items={grouped} itemKey="lineTotal" tone="strong" />;
        },
      },
      {
        id: "costoReal",
        header: "Costo real",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => <MoneyCell value={row.original.totalCostReal} tone="muted" />,
      },
      {
        id: "inversionRecuperada",
        header: "Inversión recuperada",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <MoneyCell value={resolveSaleFinancials(row.original).inversionRecuperada} tone="pos" />
        ),
      },
      {
        id: "utilidadBruta",
        header: "Utilidad bruta",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => <MoneyCell value={row.original.totalUtilidadBruta} tone="muted" />,
      },
      {
        id: "costosFijos",
        header: "Costos fijos",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => <MoneyCell value={row.original.totalCostosFijos} tone="neg" negative />,
      },
      {
        id: "utilidadNeta",
        header: "Utilidad neta",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => <MoneyCell value={row.original.totalUtilidadNeta} tone="strong" />,
      },
      {
        accessorKey: "comisionVendedor",
        header: "Comisión",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="nums font-semibold text-accent-2">
            {row.original.comisionVendedor !== undefined ? formatCordobas(row.original.comisionVendedor) : "—"}
            {row.original.comisionPercent !== undefined && (
              <span className="ml-0.5 text-[11px] font-normal text-muted">({row.original.comisionPercent}%)</span>
            )}
          </span>
        ),
      },
      {
        accessorKey: "gananciaTienda",
        header: "Ganancia tienda",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="nums font-bold text-whatsapp">
            {row.original.gananciaTienda !== undefined ? formatCordobas(row.original.gananciaTienda) : "—"}
          </span>
        ),
      }
];
