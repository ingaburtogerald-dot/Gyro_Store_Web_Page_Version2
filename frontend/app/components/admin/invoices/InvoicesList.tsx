// Tabla de tickets (presentacional): recibe los datos y delega acciones al panel.
// Acciones en menú "⋯" (convención del proyecto) y celdas canónicas de DataTable.
// Versión premium: glow badges, ticket badge estilizado y mobile cards.
import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Printer, Pencil, Ban, User, ShoppingBag, Hash } from "lucide-react";
import { DataTable } from "~/components/ui/DataTable";
import { RowActionsMenu } from "~/components/ui/RowActionsMenu";
import { MoneyCell } from "~/components/ui/cells";
import { Card } from "~/components/ui/Card";
import { StatusBadge, type BadgeStatus } from "~/components/ui/StatusBadge";
import { formatCordobas } from "~/lib/utils";
import { type Invoice, type InvoiceStatus } from "~/store/api/invoicesApi";

// Estado del ticket → props del StatusBadge canónico del sistema de diseño.
const STATUS_META: Record<InvoiceStatus, { label: string; status: BadgeStatus; pulse?: boolean }> = {
  unlinked: { label: "Pendiente", status: "pending", pulse: true },
  linked: { label: "Registrado", status: "success" },
  void: { label: "Anulado", status: "error" },
  paid: { label: "Pagado", status: "whatsapp" },
};

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const m = STATUS_META[status] || STATUS_META.unlinked;
  return <StatusBadge status={m.status} label={m.label} pulse={m.pulse} glow />;
}

/** Badge estilizado para el número de ticket */
function TicketBadge({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-accent/8 px-2 py-0.5 font-mono text-xs font-semibold text-accent-2 border border-accent/15">
      <Hash className="h-3 w-3 opacity-50" />
      {value}
    </span>
  );
}

export function InvoicesList({
  invoices,
  isAdmin,
  onPrint,
  onEdit,
  onVoid,
}: {
  invoices: Invoice[];
  isAdmin: boolean;
  onPrint: (inv: Invoice) => void;
  onEdit: (inv: Invoice) => void;
  onVoid: (inv: Invoice) => void;
}) {
  const columns = useMemo<ColumnDef<Invoice, any>[]>(
    () => [
      {
        accessorKey: "ticketNumber",
        header: "Ticket",
        cell: (c) => <TicketBadge value={c.getValue()} />,
      },
      {
        accessorKey: "createdAt",
        header: "Fecha",
        cell: (c) =>
          c.getValue() ? (
            <span className="text-sm text-muted">
              {new Date(c.getValue()).toLocaleString("es-NI", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
      {
        accessorFn: (i) =>
          `${i.customer?.firstName || ""} ${i.customer?.lastName || ""}`.trim() || "—",
        id: "customer",
        header: "Cliente",
        cell: (c) => (
          <span className="flex items-center gap-1.5 font-medium text-text">
            <User className="h-3.5 w-3.5 text-muted/60" />
            {c.getValue()}
          </span>
        ),
      },
      {
        accessorFn: (i) => i.items.map((x) => x.productName).join(", "),
        id: "products",
        header: "Productos",
        cell: (c) => (
          <span className="line-clamp-1 text-sm text-muted" title={c.getValue()}>
            {c.getValue()}
          </span>
        ),
      },
      {
        accessorFn: (i) => i.assignedSeller?.name || i.sellerName || "—",
        id: "seller",
        header: "Vendedor",
        cell: (c) => <span className="text-sm text-muted">{c.getValue()}</span>,
      },
      {
        accessorKey: "total",
        header: "Total",
        meta: { align: "right" },
        cell: (c) => <MoneyCell value={c.getValue()} tone="strong" />,
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: (c) => <InvoiceStatusBadge status={c.getValue() as InvoiceStatus} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const inv = row.original;
          const pending = inv.status === "unlinked";
          return (
            <div className="flex justify-end">
              <RowActionsMenu
                actions={[
                  {
                    label: "Reimprimir",
                    icon: <Printer className="h-4 w-4" />,
                    onClick: () => onPrint(inv),
                  },
                  pending && {
                    label: "Editar",
                    icon: <Pencil className="h-4 w-4" />,
                    onClick: () => onEdit(inv),
                  },
                  pending &&
                    isAdmin && {
                      label: "Anular ticket",
                      icon: <Ban className="h-4 w-4" />,
                      danger: true,
                      separatorBefore: true,
                      onClick: () => onVoid(inv),
                    },
                ]}
              />
            </div>
          );
        },
      },
    ],
    [isAdmin, onPrint, onEdit, onVoid],
  );

  /** Mobile card: tarjeta moderna para cada ticket */
  function mobileCard(inv: Invoice) {
    const customerName =
      `${inv.customer?.firstName || ""} ${inv.customer?.lastName || ""}`.trim() || "Sin cliente";
    const products = inv.items.map((x) => x.productName).join(", ");
    const pending = inv.status === "unlinked";

    return (
      <Card interactive className="relative p-4">
        {/* Header: ticket + status */}
        <div className="mb-3 flex items-center justify-between">
          <TicketBadge value={inv.ticketNumber} />
          <InvoiceStatusBadge status={inv.status} />
        </div>

        {/* Cliente */}
        <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
          <User className="h-3.5 w-3.5 text-muted/60" />
          {customerName}
        </p>

        {/* Productos */}
        <p className="mt-1 line-clamp-2 flex items-start gap-1.5 text-xs text-muted" title={products}>
          <ShoppingBag className="mt-0.5 h-3 w-3 shrink-0 text-muted/50" />
          {products}
        </p>

        {/* Footer: total + vendedor + acciones */}
        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
          <div>
            <p className="font-heading text-lg font-bold text-text nums">
              {formatCordobas(inv.total)}
            </p>
            {(inv.assignedSeller?.name || inv.sellerName) && (
              <p className="text-[11px] text-muted">
                {inv.assignedSeller?.name || inv.sellerName}
              </p>
            )}
          </div>
          <RowActionsMenu
            actions={[
              {
                label: "Reimprimir",
                icon: <Printer className="h-4 w-4" />,
                onClick: () => onPrint(inv),
              },
              pending && {
                label: "Editar",
                icon: <Pencil className="h-4 w-4" />,
                onClick: () => onEdit(inv),
              },
              pending &&
                isAdmin && {
                  label: "Anular ticket",
                  icon: <Ban className="h-4 w-4" />,
                  danger: true,
                  separatorBefore: true,
                  onClick: () => onVoid(inv),
                },
            ]}
          />
        </div>
      </Card>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={invoices}
      searchPlaceholder="Buscar por ticket, cliente, producto…"
      emptyText="Sin tickets en esta vista."
      mobileCard={mobileCard}
    />
  );
}
