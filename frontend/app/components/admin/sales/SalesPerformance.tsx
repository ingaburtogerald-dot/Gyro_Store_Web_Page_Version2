// Tabla comparativa de performance por vendedor.
import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "~/components/ui/DataTable";
import { useGetPerformanceQuery, type SellerPerformance } from "~/store/api/salesApi";
import { formatCordobas } from "~/lib/utils";

export function SalesPerformance({ selectedMonth }: { selectedMonth: string }) {
  const isAll = selectedMonth === "all";
  const [y, m] = isAll ? [0, 0] : selectedMonth.split("-").map(Number);
  const { data = [], isLoading } = useGetPerformanceQuery(isAll ? { allTime: true } : { year: y, month: m - 1 });

  const columns = useMemo<ColumnDef<SellerPerformance, any>[]>(
    () => [
      { accessorKey: "sellerName", header: "Vendedor" },
      { accessorKey: "ventas", header: "Ventas (mes)" },
      { accessorKey: "totalVendido", header: "Total vendido", cell: (c) => formatCordobas(c.getValue()) },
      {
        accessorKey: "comisiones",
        header: "Comisión total",
        cell: (c) => <span className="font-semibold text-emerald-400">{formatCordobas(c.getValue())}</span>,
      },
      {
        accessorKey: "comisionPromedio",
        header: "Comisión promedio",
        cell: (c) => <span className="font-mono text-xs text-muted-foreground">{formatCordobas(c.getValue())}</span>,
      },
      {
        accessorKey: "ticketPromedio",
        header: "Ticket promedio",
        cell: (c) => <span className="font-bold text-whatsapp">{formatCordobas(c.getValue())}</span>,
      },
    ],
    [],
  );

  if (isLoading) return <div className="h-40 animate-pulse rounded-card border border-border bg-surface" />;

  return (
    <div className="rounded-card border border-border bg-surface p-4 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-text">Desempeño de Vendedores</h2>
        <p className="text-xs text-muted">Comparativa acumulada para el mes actual.</p>
      </div>
      <DataTable columns={columns} data={data} searchPlaceholder="Buscar vendedor…" emptyText="Sin datos de ventas." />
    </div>
  );
}

