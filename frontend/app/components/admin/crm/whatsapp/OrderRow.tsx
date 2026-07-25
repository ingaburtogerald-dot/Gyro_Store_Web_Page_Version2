import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Clock, Trash2, Archive, Eye } from "lucide-react";
import { StatusBadge } from "~/components/ui/StatusBadge";
import { PublicOrderModal } from "./PublicOrderModal";
import { cn, formatCordobas } from "~/lib/utils";
import {
  useMarkContactedMutation,
  useDeletePublicOrderMutation,
  useLogOrderFollowUpMutation,
} from "~/store/api/salesApi";
import type { PublicOrder } from "~/store/api/salesApi";

export function OrderRow({ order, index }: { order: PublicOrder; index: number }) {
  const [markContacted] = useMarkContactedMutation();
  const [deleteOrder] = useDeletePublicOrderMutation();
  const [logFollowUp] = useLogOrderFollowUpMutation();
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  async function toggleContacted() {
    setLoading(true);
    try {
      await markContacted({ id: order.id, contacted: !order.contacted }).unwrap();
      toast.success(order.contacted ? "Marcado como no contactado." : "Marcado como contactado.");
    } catch {
      toast.error("No se pudo actualizar el estado.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("¿Seguro que deseas eliminar este pedido? (No se puede deshacer)")) return;
    setLoading(true);
    try {
      await deleteOrder(order.id).unwrap();
      toast.success("Pedido eliminado.");
    } catch {
      toast.error("Error al eliminar pedido.");
      setLoading(false);
    }
  }

  async function handleFollowUp() {
    setLoading(true);
    try {
      const res = await logFollowUp(order.id).unwrap();
      toast.success(`Intento registrado (${res.contactAttempts}/3)`);
      if (res.archived) {
        toast.info("El pedido ha sido archivado (3 intentos máximos).");
      }
    } catch {
      toast.error("Error al registrar el seguimiento.");
    } finally {
      setLoading(false);
    }
  }

  const date = order.createdAt ? new Date(order.createdAt).toLocaleString("es-NI") : "—";
  const isArchived = order.archived;
  const attempts = order.contactAttempts || 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18, delay: Math.min(index, 8) * 0.03, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group relative flex flex-col justify-between rounded-card border bg-surface p-5 transition-colors duration-200",
        isArchived
          ? "border-border/60 opacity-60"
          : "border-border hover:border-accent/30 hover:bg-surface-hover",
      )}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-bold leading-tight text-text">{order.customerName}</h3>
            <p className="mt-1 font-mono text-xs text-muted">{order.customerPhone}</p>
            <div className="mt-2.5 flex items-center gap-2">
              {order.contacted ? (
                <StatusBadge status="success" label="Contactado" />
              ) : (
                <StatusBadge status="pending" label="Pendiente" pulse />
              )}
              <span className="text-[11px] tabular-nums text-muted/70">{date}</span>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            title="Ver detalles"
            aria-label="Ver detalles"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-input text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between items-start gap-3 text-sm">
              <span className="text-text leading-snug flex-1">
                <span className="font-bold text-accent-2 mr-1.5">{item.quantity}x</span>
                {item.name}
              </span>
              <span className="text-muted font-medium shrink-0">{formatCordobas(item.lineTotal)}</span>
            </div>
          ))}
        </div>

        <div className="flex items-end justify-between border-t border-border pt-3">
          <div className="flex flex-col gap-1 text-sm text-muted">
            <span className="font-medium text-text">
              {order.deliveryMethod === "envio" ? "🚚 Envío a domicilio" : "🏬 Retiro en tienda"}
            </span>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-accent leading-none">{formatCordobas(order.total)}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 border-t border-border pt-4">
        {!isArchived ? (
          <>
            <button
              onClick={toggleContacted}
              disabled={loading}
              className={cn(
                "flex-1 rounded-input border px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50",
                order.contacted
                  ? "border-accent/40 bg-accent/10 text-accent-2 hover:bg-accent/15"
                  : "border-border bg-surface-2 text-text hover:border-accent/30 hover:bg-surface-hover",
              )}
            >
              {order.contacted ? "Quitar contactado" : "Marcar contactado"}
            </button>
            <button
              onClick={handleFollowUp}
              disabled={loading}
              title={`Intento de seguimiento ${attempts}/3`}
              className="flex h-9 min-w-11 shrink-0 items-center justify-center gap-1 rounded-input border border-border bg-surface-2 text-[11px] font-bold text-muted transition-colors hover:text-text disabled:opacity-50"
            >
              <Clock className="h-3 w-3" />
              {attempts}
            </button>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center gap-1.5 rounded-input bg-surface-2 py-2 text-xs font-bold text-muted">
            <Archive className="h-3.5 w-3.5" /> Archivado
          </div>
        )}
        <button
          onClick={handleDelete}
          disabled={loading}
          title="Eliminar pedido"
          aria-label="Eliminar pedido"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-input text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <PublicOrderModal order={order} open={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </motion.div>
  );
}
