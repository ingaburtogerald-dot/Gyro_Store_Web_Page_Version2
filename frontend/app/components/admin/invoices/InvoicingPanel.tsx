// Panel de Facturación: una métrica héroe (dinero reservado) + pestañas con
// conteo + tabla de tickets. Crear/editar ticket, reimprimir y anular van en
// modales. El ticket reserva stock FIFO al crearse; el vendedor registra su
// venta desde él.
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Receipt, Ban, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card } from "~/components/ui/Card";
import { Button } from "~/components/ui/Button";
import { Modal } from "~/components/ui/Modal";
import { CountUp } from "~/components/ui/CountUp";
import { AnimatedTabs, type TabItem } from "~/components/ui/AnimatedTabs";
import { formatCordobas } from "~/lib/utils";
import { useAppSelector } from "~/store/hooks";
import { selectIsAdmin } from "~/store/slices/authSlice";
import {
  useGetInvoicesQuery,
  useVoidInvoiceMutation,
  useDeleteInvoiceMutation,
  type Invoice,
  type InvoiceStatus,
} from "~/store/api/invoicesApi";
import { InvoicesList } from "./InvoicesList";
import { TicketFormModal } from "./TicketFormModal";
import { TicketPrintModal } from "./TicketPrintModal";

/* Etiqueta de pestaña con conteo integrado: el conteo hereda el color del tab
   (blanco cuando está activo, muted cuando no) vía `bg-current`, así una sola
   taxonomía de estado en pantalla en vez de dos apiladas. */
function TabLabel({ text, n }: { text: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {text}
      <span className="rounded-full bg-current/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums opacity-80">
        {n}
      </span>
    </span>
  );
}

export function InvoicingPanel() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const { data: invoices = [], isLoading } = useGetInvoicesQuery();
  const [voidInvoice, { isLoading: voiding }] = useVoidInvoiceMutation();
  const [deleteInvoice, { isLoading: deleting }] = useDeleteInvoiceMutation();

  const [tab, setTab] = useState<InvoiceStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [printing, setPrinting] = useState<Invoice | null>(null);
  const [toVoid, setToVoid] = useState<Invoice | null>(null);
  const [toDelete, setToDelete] = useState<Invoice | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const kpis = useMemo(() => {
    const pending = invoices.filter((i) => i.status === "unlinked");
    return {
      pending: pending.length,
      registered: invoices.filter((i) => i.status === "linked").length,
      voided: invoices.filter((i) => i.status === "void").length,
      reserved: pending.reduce((s, i) => s + (i.total || 0), 0),
    };
  }, [invoices]);

  const filtered = useMemo(
    () => (tab === "all" ? invoices : invoices.filter((i) => i.status === tab)),
    [invoices, tab],
  );

  // El conteo vive dentro de la pestaña (una sola taxonomía de estado), no en
  // una fila de KPIs aparte que repite lo mismo.
  const tabs: TabItem[] = [
    { id: "all", label: <TabLabel text="Todos" n={invoices.length} /> },
    { id: "unlinked", label: <TabLabel text="Pendientes" n={kpis.pending} /> },
    { id: "linked", label: <TabLabel text="Registrados" n={kpis.registered} /> },
    { id: "void", label: <TabLabel text="Anulados" n={kpis.voided} /> },
  ];

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  async function confirmVoid() {
    if (!toVoid) return;
    if (!voidReason.trim()) return toast.error("El motivo de anulación es obligatorio.");
    try {
      await voidInvoice({ id: toVoid.id, reason: voidReason.trim() }).unwrap();
      toast.success(`Ticket ${toVoid.ticketNumber} anulado. El stock quedó liberado.`);
      setToVoid(null);
      setVoidReason("");
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo anular el ticket.");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await deleteInvoice(toDelete.id).unwrap();
      toast.success(`Ticket ${toDelete.ticketNumber} eliminado permanentemente.`);
      setToDelete(null);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo eliminar el ticket.");
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header con gradiente y CTA ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
            Facturación
          </h1>
          <p className="mt-1 max-w-prose text-sm text-muted">
            Cada ticket reserva el stock y queda pendiente hasta que el vendedor registre la venta.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> Nuevo ticket
        </Button>
      </motion.div>

      {/* ── Métrica héroe: el dinero inmovilizado esperando cobro. Es el número
             que de verdad importa, así que domina la franja superior. ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 26, delay: 0.05 }}
      >
        <Card className="relative overflow-hidden p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Reservado en tickets pendientes
              </p>
              <p className="mt-2 font-heading text-3xl font-bold tabular-nums text-accent-2 sm:text-4xl">
                <CountUp value={kpis.reserved} format={formatCordobas} />
              </p>
              <p className="mt-1 text-sm text-muted">
                {kpis.pending === 0
                  ? "Todo al día: no hay stock reservado sin registrar."
                  : `${kpis.pending} ${kpis.pending === 1 ? "ticket espera" : "tickets esperan"} que el vendedor registre la venta.`}
              </p>
            </div>
            <div className="hidden shrink-0 rounded-2xl bg-accent/10 p-4 text-accent-2 sm:block">
              <Receipt className="h-7 w-7" />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ── Pestañas con conteo integrado e indicador deslizante ── */}
      <AnimatedTabs
        items={tabs}
        value={tab}
        onChange={(id) => setTab(id as InvoiceStatus | "all")}
        layoutId="invoicing-tabs"
      />

      {/* ── Tabla / Lista de tickets ── */}
      {isLoading ? (
        <Card className="h-64 animate-pulse" />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <InvoicesList
            invoices={filtered}
            isAdmin={isAdmin}
            onPrint={setPrinting}
            onEdit={(inv) => { setEditing(inv); setFormOpen(true); }}
            onVoid={setToVoid}
            onDelete={setToDelete}
          />
        </motion.div>
      )}

      {/* ── Modal: Crear / Editar ticket ── */}
      {formOpen && (
        <TicketFormModal
          key={editing?.id ?? "new"}
          initial={editing}
          onClose={() => { setFormOpen(false); setEditing(null); }}
          onCreated={(invoice) => { setFormOpen(false); setPrinting(invoice); }}
        />
      )}

      {/* ── Modal: Reimprimir ticket ── */}
      {printing && <TicketPrintModal invoice={printing} onClose={() => setPrinting(null)} />}

      {/* ── Modal: Anular ticket (premium) ── */}
      <Modal open={!!toVoid} onClose={() => setToVoid(null)} title={`Anular ticket ${toVoid?.ticketNumber || ""}`}>
        <div className="space-y-4">
          {/* Ícono de advertencia con glow */}
          <div className="flex justify-center">
            <div className="rounded-full bg-danger/10 p-4">
              <AlertTriangle className="h-8 w-8 text-danger" />
            </div>
          </div>

          {/* Aviso */}
          <div className="rounded-xl border border-danger/20 bg-danger/8 px-4 py-3 text-sm leading-relaxed text-danger/90">
            Al anular, las reservas de stock del ticket se liberan y el ticket ya no podrá usarse
            para registrar una venta. Queda registrado en la auditoría.
          </div>

          {/* Motivo */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Motivo de anulación *
            </span>
            <textarea
              className="input min-h-24 w-full transition-colors focus:border-danger"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Ej.: el cliente rechazó la entrega, error de digitación…"
            />
          </label>

          {/* Acciones */}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" size="sm" onClick={() => setToVoid(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmVoid} loading={voiding}>
              <Ban className="h-4 w-4" /> Anular ticket
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Eliminar ticket permanentemente (premium) ── */}
      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title={`Eliminar ticket ${toDelete?.ticketNumber || ""}`}>
        <div className="space-y-4">
          {/* Ícono de advertencia */}
          <div className="flex justify-center">
            <div className="rounded-full bg-danger/10 p-4">
              <Trash2 className="h-8 w-8 text-danger" />
            </div>
          </div>

          {/* Aviso */}
          <div className="rounded-xl border border-danger/20 bg-danger/8 px-4 py-3 text-sm leading-relaxed text-danger/90">
            <p className="font-semibold">Esta acción es irreversible.</p>
            <p className="mt-1">
              El ticket será eliminado permanentemente de la base de datos.
              {toDelete?.status === "unlinked" && " Las reservas de stock se liberarán automáticamente."}
            </p>
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" size="sm" onClick={() => setToDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete} loading={deleting}>
              <Trash2 className="h-4 w-4" /> Eliminar permanentemente
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
