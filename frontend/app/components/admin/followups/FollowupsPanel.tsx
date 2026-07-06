// CRM de seguimientos: resumen, filtros, tabla con semáforo y acciones.
import { useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { Plus, Check, RotateCcw, Pencil, Trash2, MessageCircle, AlarmClock } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "~/components/ui/DataTable";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { StatCard } from "~/components/ui/StatCard";
import { StatusBadge } from "~/components/ui/StatusBadge";
import { FollowupModal } from "./FollowupModal";
import { dueState, DUE_META, TYPE_META, STATUS_META, isDue, waLink } from "./followupUtils";
import {
  useGetFollowupsQuery,
  useSetFollowupStatusMutation,
  useDeleteFollowupMutation,
  type Followup,
} from "~/store/api/followupsApi";
import { cn } from "~/lib/utils";

export function FollowupsPanel() {
  const { data: followups = [], isLoading } = useGetFollowupsQuery();
  const [setStatus] = useSetFollowupStatusMutation();
  const [del, { isLoading: deleting }] = useDeleteFollowupMutation();

  const [formOpen, setFormOpen] = useState(false);
  const [editFor, setEditFor] = useState<Followup | null>(null);
  const [deleteFor, setDeleteFor] = useState<Followup | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "done" | "lost">("pending");

  const counts = useMemo(() => {
    let overdue = 0, today = 0, pending = 0;
    for (const f of followups) {
      if (f.status !== "pending") continue;
      pending++;
      const s = dueState(f);
      if (s === "overdue") overdue++;
      else if (s === "today") today++;
    }
    return { overdue, today, pending };
  }, [followups]);

  const rows = useMemo(
    () => (statusFilter === "all" ? followups : followups.filter((f) => f.status === statusFilter)),
    [followups, statusFilter],
  );

  async function markStatus(f: Followup, status: Followup["status"]) {
    try {
      await setStatus({ id: f.id, status }).unwrap();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo actualizar.");
    }
  }

  async function handleDelete() {
    if (!deleteFor) return;
    try {
      await del(deleteFor.id).unwrap();
      toast.success("Seguimiento eliminado.");
      setDeleteFor(null);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo eliminar.");
    }
  }

  const columns = useMemo<ColumnDef<Followup, any>[]>(
    () => [
      {
        id: "due",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const m = DUE_META[dueState(row.original)];
          return (
            <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", m.text)}>
              <span className={cn("h-2 w-2 rounded-full", m.dot)} /> {m.label}
            </span>
          );
        },
      },
      {
        accessorKey: "customerName",
        header: "Cliente",
        cell: (c) => (
          <div>
            <div className="font-semibold text-text">{c.getValue()}</div>
            {c.row.original.customerPhone && <div className="text-[11px] text-muted">{c.row.original.customerPhone}</div>}
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: "Tipo",
        cell: (c) => {
          const m = TYPE_META[c.getValue() as Followup["type"]];
          return <span className={`rounded-pill px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
        },
      },
      {
        id: "detail",
        header: "Producto / Nota",
        enableSorting: false,
        cell: ({ row }) => {
          const f = row.original;
          return (
            <div className="max-w-[260px] text-xs">
              {f.product && <div className="font-medium text-text truncate" title={f.product}>{f.product}</div>}
              {f.note && <div className="text-muted truncate" title={f.note}>{f.note}</div>}
              {!f.product && !f.note && <span className="text-muted">—</span>}
            </div>
          );
        },
      },
      {
        accessorKey: "followUpDate",
        header: "Follow-up",
        cell: (c) => <span className="font-mono text-xs">{c.getValue()}</span>,
      },
      {
        accessorKey: "ownerName",
        header: "Registró",
        cell: (c) => <span className="text-xs text-muted">{c.getValue()}</span>,
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: (c) => {
          const m = STATUS_META[c.getValue() as Followup["status"]];
          return <StatusBadge status={m.status} label={m.label} />;
        },
      },
      {
        id: "actions",
        header: "Acciones",
        enableSorting: false,
        cell: ({ row }) => {
          const f = row.original;
          return (
            <div className="flex items-center gap-1">
              {f.status === "pending" ? (
                <button onClick={() => markStatus(f, "done")} title="Marcar como hecho" className="rounded-lg p-1.5 text-muted hover:text-whatsapp hover:bg-whatsapp/10">
                  <Check className="h-4 w-4" />
                </button>
              ) : (
                <button onClick={() => markStatus(f, "pending")} title="Reabrir" className="rounded-lg p-1.5 text-muted hover:text-amber-300 hover:bg-amber-500/10">
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              {f.customerPhone && (
                <a
                  href={waLink(f.customerPhone, `Hola ${f.customerName}, le escribo de Gyro Store 👋`)}
                  target="_blank"
                  rel="noreferrer"
                  title="Escribir por WhatsApp"
                  className="rounded-lg p-1.5 text-muted hover:text-whatsapp hover:bg-whatsapp/10"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
              )}
              <button onClick={() => setEditFor(f)} title="Editar" className="rounded-lg p-1.5 text-muted hover:text-accent">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => setDeleteFor(f)} title="Eliminar" className="rounded-lg p-1.5 text-muted hover:text-red-400 hover:bg-red-500/10">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Seguimientos</h1>
          <p className="text-muted">Apunta a tus clientes y no pierdas ninguna venta por olvido.</p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-accent px-4 py-2 text-sm font-bold text-white transition-all hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nuevo seguimiento
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={AlarmClock} label="Vencidos" countTo={counts.overdue} color="rose" delay={0} />
        <StatCard icon={AlarmClock} label="Para hoy" countTo={counts.today} color="amber" delay={0.05} />
        <StatCard icon={AlarmClock} label="Pendientes" countTo={counts.pending} color="indigo" delay={0.1} />
      </div>

      <div className="rounded-card border border-border bg-surface shadow-premium p-4">
        <div className="mb-3 flex items-center gap-2">
          {(["pending", "all", "done", "lost"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-pill px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === s ? "bg-gradient-accent text-white" : "text-muted hover:text-text",
              )}
            >
              {s === "pending" ? "Pendientes" : s === "all" ? "Todos" : s === "done" ? "Hechos" : "Perdidos"}
            </button>
          ))}
        </div>

        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          searchPlaceholder="Buscar por cliente, producto…"
          emptyText="No hay seguimientos con este filtro."
        />
      </div>

      {formOpen && <FollowupModal open={formOpen} onClose={() => setFormOpen(false)} />}
      {editFor && <FollowupModal open={!!editFor} onClose={() => setEditFor(null)} item={editFor} />}

      {deleteFor && (
        <Modal open={!!deleteFor} onClose={() => setDeleteFor(null)} title="Eliminar seguimiento">
          <p className="text-sm text-muted">
            ¿Eliminar el seguimiento de <strong className="text-text">{deleteFor.customerName}</strong>? Esta acción no se puede deshacer.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteFor(null)}>Cancelar</Button>
            <Button size="sm" onClick={handleDelete} loading={deleting} className="bg-red-500/90 hover:bg-red-500">Eliminar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
