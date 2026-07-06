// Panel de Facturación: KPIs + filtro por estado + tabla de tickets.
// Crear/editar ticket, reimprimir y anular van en modales. El ticket reserva
// stock FIFO al crearse; el vendedor registra su venta desde él.
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Receipt, Clock, CheckCircle2, Ban, AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "~/components/ui/StatCard";
import { Card } from "~/components/ui/Card";
import { Button } from "~/components/ui/Button";
import { Modal } from "~/components/ui/Modal";
import { AnimatedTabs, type TabItem } from "~/components/ui/AnimatedTabs";
import { formatCordobas } from "~/lib/utils";
import { useAppSelector } from "~/store/hooks";
import { selectIsAdmin } from "~/store/slices/authSlice";
import {
  useGetInvoicesQuery,
  useVoidInvoiceMutation,
  type Invoice,
  type InvoiceStatus,
} from "~/store/api/invoicesApi";
import { InvoicesList } from "./InvoicesList";
import { TicketFormModal } from "./TicketFormModal";
import { TicketPrintModal } from "./TicketPrintModal";

const TABS: TabItem[] = [
  { id: "all", label: "Todos" },
  { id: "unlinked", label: "Pendientes" },
  { id: "linked", label: "Registrados" },
  { id: "void", label: "Anulados" },
];

/* Stagger container + child variants para las StatCards */
const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 26 } },
};

export function InvoicingPanel() {
  const isAdmin = useAppSelector(selectIsAdmin);
  const { data: invoices = [], isLoading } = useGetInvoicesQuery();
  const [voidInvoice, { isLoading: voiding }] = useVoidInvoiceMutation();

  const [tab, setTab] = useState<InvoiceStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [printing, setPrinting] = useState<Invoice | null>(null);
  const [toVoid, setToVoid] = useState<Invoice | null>(null);
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
          <h1 className="gradient-text text-2xl font-bold tracking-tight sm:text-3xl">
            Facturación
          </h1>
          <p className="mt-1 text-sm text-muted">
            Cada ticket reserva el stock y queda pendiente hasta que el vendedor registre la venta.
          </p>
        </div>
        <Button onClick={openNew}>
          <Sparkles className="h-4 w-4" /> Nuevo ticket
        </Button>
      </motion.div>

      {/* ── KPIs con stagger ── */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <motion.div variants={staggerItem}>
          <StatCard icon={Clock} label="Pendientes" countTo={kpis.pending} color="amber" />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard icon={CheckCircle2} label="Registrados" countTo={kpis.registered} color="emerald" />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard icon={Ban} label="Anulados" countTo={kpis.voided} color="rose" />
        </motion.div>
        <motion.div variants={staggerItem}>
          <StatCard icon={Receipt} label="Reservado (pendiente)" countTo={kpis.reserved} format={formatCordobas} color="indigo" />
        </motion.div>
      </motion.div>

      {/* ── Pestañas con indicador deslizante ── */}
      <AnimatedTabs
        items={TABS}
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
            <div className="rounded-full bg-red-500/10 p-4">
              <AlertTriangle className="h-8 w-8 text-rose-400" />
            </div>
          </div>

          {/* Aviso */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-sm leading-relaxed text-rose-300/90">
            Al anular, las reservas de stock del ticket se liberan y el ticket ya no podrá usarse
            para registrar una venta. Queda registrado en la auditoría.
          </div>

          {/* Motivo */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
              Motivo de anulación *
            </span>
            <textarea
              className="input min-h-24 w-full transition-colors focus:border-rose-400"
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
    </div>
  );
}
