// Historial de tickets: sin vincular / vinculados / pagados, con búsqueda.
import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "~/components/ui/DataTable";
import { useGetInvoicesQuery, type Invoice, type InvoiceStatus } from "~/store/api/invoicesApi";
import { formatCordobas, cn } from "~/lib/utils";

const STATUS_META: Record<InvoiceStatus, { label: string; cls: string }> = {
  unlinked: { label: "Sin vincular", cls: "bg-amber-500/15 text-amber-300" },
  linked: { label: "Vinculado", cls: "bg-accent/15 text-accent-2" },
  paid: { label: "Pagado", cls: "bg-whatsapp/15 text-whatsapp" },
};

const TABS: { id: InvoiceStatus | "all"; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "unlinked", label: "Sin vincular" },
  { id: "linked", label: "Vinculados" },
];

export function InvoicesList() {
  const [tab, setTab] = useState<InvoiceStatus | "all">("all");
  const { data: invoices = [], isLoading } = useGetInvoicesQuery();

  const filtered = useMemo(
    () => (tab === "all" ? invoices : invoices.filter((i) => i.status === tab)),
    [invoices, tab],
  );

  const columns = useMemo<ColumnDef<Invoice, any>[]>(
    () => [
      { accessorKey: "ticketNumber", header: "Ticket" },
      {
        accessorKey: "createdAt",
        header: "Fecha",
        cell: (c) => (c.getValue() ? new Date(c.getValue()).toLocaleString("es-NI") : "—"),
      },
      { accessorFn: (i) => i.items.map((x) => x.productName).join(", "), id: "products", header: "Productos" },
      { accessorKey: "sellerName", header: "Atendió" },
      { accessorKey: "total", header: "Total", cell: (c) => formatCordobas(c.getValue()) },
      {
        accessorKey: "status",
        header: "Estado",
        cell: (c) => {
          const m = STATUS_META[c.getValue() as InvoiceStatus];
          return <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${m.cls}`}>{m.label}</span>;
        },
      },
    ],
    [],
  );

  if (isLoading) return <div className="h-64 animate-pulse rounded-card border border-border bg-surface" />;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-pill border border-border bg-surface p-1 sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-pill px-4 py-2 text-sm font-medium transition-colors",
              tab === t.id ? "bg-gradient-accent text-white" : "text-muted hover:text-text",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <DataTable columns={columns} data={filtered} searchPlaceholder="Buscar por ticket, producto…" emptyText="Sin tickets." />
    </div>
  );
}
