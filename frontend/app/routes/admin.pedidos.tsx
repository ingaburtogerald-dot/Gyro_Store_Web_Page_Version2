// Portal de Pedidos Públicos — vista de quién escribió por WhatsApp desde el catálogo.
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Check, Clock, Trash2, PhoneForwarded, Archive } from "lucide-react";
import { RequireRole } from "~/components/admin/RequireRole";
import { 
  useGetPublicOrdersQuery, 
  useMarkContactedMutation, 
  useDeletePublicOrderMutation,
  useLogOrderFollowUpMutation,
  type PublicOrder 
} from "~/store/api/salesApi";
import { formatCordobas, cn } from "~/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

function OrderRow({ order }: { order: PublicOrder }) {
  const [markContacted] = useMarkContactedMutation();
  const [deleteOrder] = useDeletePublicOrderMutation();
  const [logFollowUp] = useLogOrderFollowUpMutation();
  const [loading, setLoading] = useState(false);

  async function toggle() {
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
  
  // Limpiar teléfono para el link (remover espacios, signos de + o -)
  const cleanPhone = order.customerPhone.replace(/[\s\+\-]/g, '');
  const waText = encodeURIComponent(`Hola ${order.customerName.split(' ')[0]}, vimos tu pedido en Gyro Store por ${formatCordobas(order.total)}. ¿Te gustaría que coordinemos el pago y envío?`);
  const waLink = `https://wa.me/${cleanPhone}?text=${waText}`;

  const isArchived = order.archived;
  const attempts = order.contactAttempts || 0;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-surface p-5 shadow-premium transition-all hover:shadow-premium-hover",
        isArchived ? "border-border/50 bg-surface/50 opacity-75" : "border-border"
      )}
    >
      {/* Indicador de intentos */}
      {!isArchived && attempts > 0 && (
        <div className="absolute top-0 right-0 rounded-bl-xl bg-warning/10 px-3 py-1 text-[11px] font-bold text-warning">
          Intento {attempts}/3
        </div>
      )}
      {isArchived && (
        <div className="absolute top-0 right-0 rounded-bl-xl bg-surface-2 px-3 py-1 text-[11px] font-bold text-muted flex items-center gap-1">
          <Archive className="h-3 w-3" /> Archivado
        </div>
      )}

      <div className="space-y-4">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3 pt-1">
          <div>
            <h3 className="text-base font-bold text-text line-clamp-1">{order.customerName}</h3>
            <p className="font-mono text-sm text-muted">{order.customerPhone}</p>
            <p className="text-[11px] text-muted/70 mt-1">{date}</p>
          </div>
          <button
            onClick={toggle}
            disabled={loading}
            title={order.contacted ? "Marcar como pendiente" : "Marcar como contactado"}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
              order.contacted
                ? "bg-accent/15 text-accent-2 hover:bg-accent/25"
                : "bg-surface-2 text-muted hover:bg-surface-3 hover:text-text"
            )}
          >
            {order.contacted ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
          </button>
        </div>

        {/* Productos */}
        <div className="space-y-3 rounded-xl bg-surface-2/40 p-3.5 border border-border/30">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between items-start gap-3 text-sm leading-snug">
              <span className="text-text leading-tight flex-1">
                <span className="font-bold text-accent-2 mr-1.5">{item.quantity}x</span>
                {item.name}
                {item.variantName && item.variantName !== "Estándar" && (
                  <span className="block text-xs text-muted mt-1 opacity-80">Variante: {item.variantName}</span>
                )}
              </span>
              <span className="text-muted font-medium shrink-0 pt-0.5">{formatCordobas(item.lineTotal)}</span>
            </div>
          ))}
        </div>

        {/* Detalles de entrega */}
        <div className="rounded-xl border border-border/50 bg-bg p-3 space-y-1.5 text-[13px]">
          <div className="flex items-start gap-2 text-muted">
            <span className="shrink-0">{order.deliveryMethod === "envio" ? "🚚" : "🏬"}</span>
            <span className="leading-snug">
              <strong className="font-medium text-text block mb-0.5">
                {order.deliveryMethod === "envio" ? "Envío a domicilio" : "Retiro en tienda"}
              </strong>
              {order.deliveryMethod === "envio" && order.address}
            </span>
          </div>
          {order.note && (
            <div className="flex items-start gap-2 text-muted mt-2 border-t border-border/50 pt-2">
              <span className="shrink-0">📝</span>
              <span className="italic leading-snug">{order.note}</span>
            </div>
          )}
        </div>

        {/* Totales */}
        <div className="flex items-end justify-between px-1 pt-1">
          <span className="text-sm font-medium text-muted">Total del pedido</span>
          <div className="text-right">
            {order.discount > 0 && (
              <p className="text-[11px] text-muted line-through mb-0.5">{formatCordobas(order.subtotal)}</p>
            )}
            <p className="text-xl font-black text-accent">{formatCordobas(order.total)}</p>
          </div>
        </div>
      </div>

      {/* Footer Acciones */}
      <div className="mt-5 flex items-center gap-2 border-t border-border pt-4">
        <button
          onClick={handleDelete}
          disabled={loading}
          title="Eliminar pedido"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger transition-colors hover:bg-danger hover:text-white disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        
        {!isArchived ? (
          <>
            <button
              onClick={handleFollowUp}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-xs font-semibold text-text transition-colors hover:bg-surface-3 disabled:opacity-50"
            >
              <Clock className="h-3.5 w-3.5 text-muted" />
              Intento ({attempts}/3)
            </button>
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#25D366]/10 px-3 py-2 text-xs font-semibold text-[#25D366] transition-colors hover:bg-[#25D366]/20"
            >
              <PhoneForwarded className="h-3.5 w-3.5" />
              Contactar
            </a>
          </>
        ) : (
          <div className="flex-1 text-center text-xs font-medium text-muted">
            Pedido archivado (Límite alcanzado)
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function Pedidos() {
  const { data: orders = [], isLoading } = useGetPublicOrdersQuery();
  const [filter, setFilter] = useState<"pending" | "contacted" | "archived">("pending");

  const filtered = orders.filter((o) => {
    if (filter === "archived") return o.archived;
    if (o.archived) return false; // Hide archived from pending/contacted

    if (filter === "pending") return !o.contacted;
    if (filter === "contacted") return o.contacted;
    return true;
  });

  const pendingCount = orders.filter((o) => !o.contacted && !o.archived).length;

  return (
    <RequireRole allowed={["admin"]}>
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-text">Pedidos por WhatsApp</h1>
            <p className="text-sm text-muted mt-1">
              Gestiona y da seguimiento a los pedidos entrantes del catálogo público
            </p>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 rounded-full bg-warning/15 px-4 py-2 text-sm font-bold text-warning shadow-sm">
              <MessageCircle className="h-4 w-4" />
              {pendingCount} sin contactar
            </div>
          )}
        </div>

        <div className="flex gap-2 border-b border-border pb-1">
          {(["pending", "contacted", "archived"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "relative rounded-t-xl px-4 py-2 text-sm font-medium transition-colors outline-none",
                filter === f
                  ? "text-accent-2"
                  : "text-muted hover:text-text hover:bg-surface-2/50"
              )}
            >
              {f === "pending" ? "Pendientes" : f === "contacted" ? "Contactados" : "Archivados"}
              {filter === f && (
                <motion.div
                  layoutId="whatsappTabs"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent"
                />
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-surface-2" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-4 py-24 text-center rounded-3xl border border-dashed border-border bg-surface-2/30"
          >
            <div className="grid h-16 w-16 place-items-center rounded-full bg-surface-3 text-muted">
              {filter === "archived" ? <Archive className="h-8 w-8" /> : <MessageCircle className="h-8 w-8" />}
            </div>
            <div>
              <p className="text-base font-semibold text-text">
                {filter === "archived" ? "No hay pedidos archivados" : "No hay pedidos pendientes"}
              </p>
              <p className="text-sm text-muted mt-1">
                {filter === "archived" 
                  ? "Los pedidos se archivan luego de 3 intentos de seguimiento."
                  : "Los nuevos pedidos que los clientes envíen aparecerán aquí."}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            layout
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start"
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((order) => (
                <OrderRow key={order.id} order={order} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </RequireRole>
  );
}
