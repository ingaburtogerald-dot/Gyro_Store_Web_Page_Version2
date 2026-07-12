// Tabla de tickets (presentacional): recibe los datos y delega acciones al panel.
// Acciones en menú "⋯" (convención del proyecto) y celdas canónicas de DataTable.
// Versión premium: glow badges, ticket badge estilizado y mobile cards.
import { useMemo } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Printer, Pencil, Ban, Trash2, User, ShoppingBag, Hash, Receipt } from "lucide-react";
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

// Sin `glow`: en una tabla larga, un halo por fila es ruido. El punto pulsante
// del estado "pendiente" basta para señalar lo que espera acción.
function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const m = STATUS_META[status] || STATUS_META.unlinked;
  return <StatusBadge status={m.status} label={m.label} pulse={m.pulse} />;
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
  onDelete,
}: {
  invoices: Invoice[];
  isAdmin: boolean;
  onPrint: (inv: Invoice) => void;
  onEdit: (inv: Invoice) => void;
  onVoid: (inv: Invoice) => void;
  onDelete: (inv: Invoice) => void;
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
        // Compacta y de dos niveles: la fecha lee como ancla temporal, la hora
        // queda subordinada. Menos ancho, menos ruido que un datetime corrido.
        cell: (c) => {
          const v = c.getValue();
          if (!v) return <span className="text-muted">—</span>;
          const d = new Date(v);
          return (
            <div className="leading-tight" title={d.toLocaleString("es-NI")}>
              <div className="text-sm text-text/80">
                {d.toLocaleDateString("es-NI", { day: "2-digit", month: "short" })}
              </div>
              <div className="text-[11px] text-muted">
                {d.toLocaleTimeString("es-NI", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          );
        },
      },
      {
        accessorFn: (i) =>
          `${i.customer?.firstName || ""} ${i.customer?.lastName || ""}`.trim() || "—",
        id: "customer",
        header: "Cliente",
        // Ancla del escaneo: nombre en semibold; el teléfono va debajo, callado.
        cell: ({ row, getValue }) => {
          const phone = row.original.customer?.phone;
          return (
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 shrink-0 text-muted/60" />
              <div className="leading-tight">
                <div className="font-semibold text-text">{getValue()}</div>
                {phone && <div className="text-[11px] text-muted">{phone}</div>}
              </div>
            </div>
          );
        },
      },
      {
        accessorFn: (i) => i.items.map((x) => x.productName).join(", "),
        id: "products",
        header: "Productos",
        cell: ({ row, getValue }) => {
          const count = row.original.items.length;
          return (
            <div className="max-w-[22ch]" title={getValue()}>
              <div className="line-clamp-1 text-xs text-muted">{getValue()}</div>
              <div className="text-[11px] text-muted/70">
                {count} {count === 1 ? "artículo" : "artículos"}
              </div>
            </div>
          );
        },
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
          const canDelete = isAdmin && inv.status !== "linked";
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
                  canDelete && {
                    label: "Eliminar",
                    icon: <Trash2 className="h-4 w-4" />,
                    danger: true,
                    separatorBefore: !pending,
                    onClick: () => onDelete(inv),
                  },
                ]}
              />
            </div>
          );
        },
      },
    ],
    [isAdmin, onPrint, onEdit, onVoid, onDelete],
  );

  /** Mobile card: tarjeta moderna para cada ticket */
  function mobileCard(inv: Invoice) {
    const customerName =
      `${inv.customer?.firstName || ""} ${inv.customer?.lastName || ""}`.trim() || "Sin cliente";
    const products = inv.items.map((x) => x.productName).join(", ");
    const pending = inv.status === "unlinked";

    return (
      <Card className="relative p-4 transition-colors hover:border-accent/40 cursor-pointer">
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
              isAdmin && inv.status !== "linked" && {
                label: "Eliminar",
                icon: <Trash2 className="h-4 w-4" />,
                danger: true,
                separatorBefore: !pending,
                onClick: () => onDelete(inv),
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
      emptyText={<EmptyTickets />}
      mobileCard={mobileCard}
    />
  );
}

/** Empty state con intención: ícono, mensaje y siguiente paso claro. */
function EmptyTickets() {
  return (
    <div className="flex flex-col items-center gap-2 py-6">
      <div className="rounded-2xl bg-accent/10 p-3 text-accent-2">
        <Receipt className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-text">No hay tickets en esta vista</p>
      <p className="max-w-xs text-xs text-muted">
        Genera un ticket con <span className="font-semibold text-text">Nuevo ticket</span> o cambia
        de pestaña para ver otro estado.
      </p>
    </div>
  );
}
