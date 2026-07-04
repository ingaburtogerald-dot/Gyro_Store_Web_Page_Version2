// Columnas de la tabla UNIFICADA de pérdidas + gastos. Una sola tabla donde la columna
// "Tipo" (badge) y "Concepto" se adaptan al dominio de cada fila.
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import type { LossRecord, LossCategory } from "~/store/api/reportsApi";
import { cn } from "~/lib/utils";

const LOSS_CATEGORY_LABEL: Record<LossCategory, string> = {
  robo: "Robo", daño: "Daño", devolucion: "Devolución",
};

const money = (r: LossRecord) => `${r.currency === "USD" ? "$" : "C$"}${r.amount}`;

function TypeBadge({ record }: { record: LossRecord }) {
  const isExpense = record.kind === "expense";
  const label = isExpense ? "Gasto" : LOSS_CATEGORY_LABEL[record.category as LossCategory] ?? "Pérdida";
  return (
    <span
      className={cn(
        "inline-block rounded-pill px-2 py-0.5 text-[11px] font-semibold",
        isExpense ? "bg-amber-500/15 text-amber-400" : "bg-rose-500/15 text-rose-400",
      )}
    >
      {label}
    </span>
  );
}

export function createRecordColumns(
  onEdit: (record: LossRecord) => void,
  groupLabel: Record<string, string>,
): ColumnDef<LossRecord>[] {
  return [
    { accessorKey: "date", header: "Fecha" },
    {
      id: "type",
      header: "Tipo",
      accessorFn: (r) => (r.kind === "expense" ? "Gasto" : "Pérdida"),
      cell: ({ row }) => <TypeBadge record={row.original} />,
    },
    {
      id: "concepto",
      header: "Concepto",
      accessorFn: (r) =>
        r.kind === "expense"
          ? `${groupLabel[r.group ?? ""] ?? r.group ?? ""} ${r.subcategory ?? ""}`
          : `${r.productCode ?? ""} ${r.productName ?? ""}`,
      cell: ({ row }) => {
        const r = row.original;
        if (r.kind === "expense") {
          return (
            <div className="min-w-0">
              <div className="truncate font-medium text-text">{groupLabel[r.group ?? ""] ?? r.group ?? "—"}</div>
              {r.subcategory && <div className="truncate text-xs text-muted">{r.subcategory}</div>}
            </div>
          );
        }
        return (
          <div className="min-w-0">
            <div className="truncate font-medium text-text">{r.productName ?? "—"}</div>
            {r.productCode && <div className="truncate text-xs font-mono text-muted">{r.productCode}</div>}
          </div>
        );
      },
    },
    {
      id: "quantity",
      header: "Cant.",
      enableSorting: false,
      meta: { align: "right" },
      cell: ({ row }) => (row.original.kind === "expense" ? "—" : row.original.quantity ?? "—"),
    },
    { accessorKey: "amount", header: "Monto", meta: { align: "right" }, cell: ({ row }) => <span className="nums font-semibold text-text">{money(row.original)}</span> },
    { accessorKey: "reason", header: "Nota", cell: ({ getValue }) => <span className="text-muted">{(getValue() as string) || "—"}</span> },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => onEdit(row.original)}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-hover hover:text-text"
          title="Editar"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ),
    },
  ];
}
