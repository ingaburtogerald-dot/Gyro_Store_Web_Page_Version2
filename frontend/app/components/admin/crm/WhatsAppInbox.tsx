// Componente de Bandeja WhatsApp — extraído de admin.pedidos.tsx para unificación en CRM.
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  MessageCircle, Clock, Trash2, PhoneForwarded, Archive,
  Eye, X, MapPin, Settings, Plus, User, Phone,
} from "lucide-react";
import { RequireRole } from "~/components/admin/RequireRole";
import { 
  useGetPublicOrdersQuery, 
  useMarkContactedMutation, 
  useDeletePublicOrderMutation,
  useLogOrderFollowUpMutation,
  useGetFullConfigQuery,
  useUpdateBusinessConfigMutation,
  type PublicOrder 
} from "~/store/api/salesApi";
import { formatCordobas, cn } from "~/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "~/components/ui/Button";
import { StatusBadge } from "~/components/ui/StatusBadge";

// ease-out exponencial del sistema (DESIGN.md §5): un único lenguaje de motion.
const EASE = [0.16, 1, 0.3, 1] as const;

function DeliverySettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: config } = useGetFullConfigQuery(undefined, { skip: !open });
  const [updateConfig, { isLoading }] = useUpdateBusinessConfigMutation();
  const [personnel, setPersonnel] = useState<{ id: string; name: string; phone: string }[]>([]);

  useEffect(() => {
    if (config?.deliveryPersonnel) {
      setPersonnel(config.deliveryPersonnel);
    }
  }, [config]);

  const handleAdd = () => {
    setPersonnel([...personnel, { id: Date.now().toString(), name: "", phone: "" }]);
  };

  const handleRemove = (id: string) => {
    setPersonnel(personnel.filter((p) => p.id !== id));
  };

  const handleChange = (id: string, field: "name" | "phone", value: string) => {
    setPersonnel(personnel.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleSave = async () => {
    const clean = personnel.filter((p) => p.name.trim() && p.phone.trim());
    try {
      await updateConfig({ deliveryPersonnel: clean }).unwrap();
      toast.success("Repartidores actualizados.");
      onClose();
    } catch {
      toast.error("Error al guardar configuración.");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-surface shadow-premium p-6"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-text">Repartidores</h2>
                <p className="text-sm text-muted">Configura tu equipo de delivery</p>
              </div>
              <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-2 bg-surface-2 hover:bg-surface-3 transition-colors">
                <X className="h-5 w-5 text-muted hover:text-text" />
              </button>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {personnel.length === 0 && (
                <p className="text-sm text-center text-muted py-4">No hay repartidores configurados.</p>
              )}
              {personnel.map((p) => (
                <div key={p.id} className="flex flex-col gap-2 p-3 bg-surface-2 rounded-xl border border-border/50">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                      <input 
                        type="text" placeholder="Nombre (Ej. Alan)" className="input pl-9 w-full bg-bg" 
                        value={p.name} onChange={(e) => handleChange(p.id, "name", e.target.value)} 
                      />
                    </div>
                    <button onClick={() => handleRemove(p.id)} className="p-2 text-danger hover:bg-danger/10 rounded-xl transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                    <input 
                      type="tel" placeholder="Teléfono (Ej. 58820006)" className="input pl-9 w-full bg-bg" 
                      value={p.phone} onChange={(e) => handleChange(p.id, "phone", e.target.value)} 
                    />
                  </div>
                </div>
              ))}
              <button onClick={handleAdd} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-medium text-muted hover:text-text hover:border-muted transition-colors">
                <Plus className="h-4 w-4" /> Agregar repartidor
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              <Button onClick={handleSave} loading={isLoading} className="w-full">
                Guardar cambios
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function PublicOrderModal({ order, open, onClose }: { order: PublicOrder; open: boolean; onClose: () => void }) {
  const { data: config } = useGetFullConfigQuery(undefined, { skip: !open });
  const deliveryPersonnel = config?.deliveryPersonnel || [];
  const [showDeliveryOptions, setShowDeliveryOptions] = useState(false);

  const date = order.createdAt ? new Date(order.createdAt).toLocaleString("es-NI") : "—";
  const cleanPhone = order.customerPhone.replace(/[\s\+\-]/g, "");
  
  // Mensaje para el cliente
  const waText = encodeURIComponent(
    `Hola ${order.customerName.split(" ")[0]}, vimos tu pedido en Gyro Store por ${formatCordobas(order.total)}. ¿Te gustaría que coordinemos el pago y envío?`
  );
  const waLink = `https://wa.me/${cleanPhone}?text=${waText}`;

  // Mensaje para el repartidor
  const getDeliveryWaLink = (phone: string, name: string) => {
    const cleanDelPhone = phone.replace(/[\s\+\-]/g, "");
    const msg = `Hola ${name}, ¿cuánto nos cobras por el delivery a esta dirección?\n\n📍 ${order.address}\n${order.locationUrl ? `🗺️ Ubicación: ${order.locationUrl}\n` : ""}\n---\n👤 Cliente: ${order.customerName}\n📞 ${order.customerPhone}\n💰 Monto del pedido: ${formatCordobas(order.total)}\n${order.note ? `📝 Nota: ${order.note}` : ""}`;
    return `https://wa.me/${cleanDelPhone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-surface shadow-premium p-6 overflow-y-auto max-h-[90vh]"
          >
            <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
              <div>
                <h2 className="text-xl font-bold text-text">Detalles del pedido</h2>
                <p className="text-sm text-muted mt-0.5">{date}</p>
              </div>
              <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-2 bg-surface-2 hover:bg-surface-3 transition-colors">
                <X className="h-5 w-5 text-muted hover:text-text" />
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Cliente info */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Cliente</h4>
                  <div className="rounded-xl bg-bg border border-border p-3 space-y-1">
                    <p className="font-semibold text-text">{order.customerName}</p>
                    <p className="font-mono text-sm text-muted">{order.customerPhone}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Entrega</h4>
                  <div className="rounded-xl bg-bg border border-border p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0">{order.deliveryMethod === "envio" ? "🚚" : "🏬"}</span>
                      <strong className="font-medium text-text">
                        {order.deliveryMethod === "envio" ? "Envío a domicilio" : "Retiro en tienda"}
                      </strong>
                    </div>
                    {order.deliveryMethod === "envio" && (
                      <div className="text-sm text-muted pl-6">
                        <p>{order.address}</p>
                        {order.locationUrl && (
                          <a href={order.locationUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline mt-2">
                            <MapPin className="h-4 w-4" />
                            Ver ubicación GPS del cliente
                          </a>
                        )}
                      </div>
                    )}
                    {order.note && (
                      <div className="border-t border-border pt-2 text-sm italic text-muted pl-6">
                        📝 {order.note}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Productos y Acciones */}
              <div className="flex flex-col h-full">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Productos ({order.items.length})</h4>
                <div className="rounded-xl bg-surface-2/40 border border-border/30 p-3 space-y-3 flex-1">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-start gap-3 text-sm">
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
                  
                  <div className="border-t border-border/50 pt-3 mt-2 space-y-1">
                    <div className="flex justify-between text-sm text-muted">
                      <span>Subtotal</span>
                      <span>{formatCordobas(order.subtotal)}</span>
                    </div>
                    {order.discount > 0 && (
                      <div className="flex justify-between text-sm text-warning">
                        <span>Descuento aplicado</span>
                        <span>-{formatCordobas(order.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-black text-accent mt-2 pt-2 border-t border-border/50">
                      <span>Total</span>
                      <span>{formatCordobas(order.total)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-center gap-1.5 rounded-input bg-whatsapp px-4 py-3 text-sm font-bold text-[#04201a] transition-colors hover:bg-whatsapp/90"
                  >
                    <PhoneForwarded className="h-4 w-4" />
                    Contactar cliente
                  </a>
                  
                  {order.deliveryMethod === "envio" && deliveryPersonnel.length === 1 && (
                    <a
                      href={getDeliveryWaLink(deliveryPersonnel[0].phone, deliveryPersonnel[0].name)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-surface-2 border border-border px-4 py-3 text-sm font-bold text-text transition-colors hover:bg-surface-3"
                    >
                      <PhoneForwarded className="h-4 w-4 text-muted" />
                      Reportar con delivery
                    </a>
                  )}

                  {order.deliveryMethod === "envio" && deliveryPersonnel.length > 1 && (
                    <div className="relative">
                      <button
                        onClick={() => setShowDeliveryOptions(!showDeliveryOptions)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-surface-2 border border-border px-4 py-3 text-sm font-bold text-text transition-colors hover:bg-surface-3"
                      >
                        <PhoneForwarded className="h-4 w-4 text-muted" />
                        Reportar con delivery
                      </button>
                      <AnimatePresence>
                        {showDeliveryOptions && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute bottom-full left-0 mb-2 w-full rounded-xl bg-surface border border-border shadow-premium overflow-hidden z-10"
                          >
                            {deliveryPersonnel.map(p => (
                              <a
                                key={p.id}
                                href={getDeliveryWaLink(p.phone, p.name)}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => setShowDeliveryOptions(false)}
                                className="block w-full px-4 py-3 text-sm font-medium text-text hover:bg-surface-2 border-b border-border/50 last:border-0"
                              >
                                Enviar mensaje a {p.name}
                              </a>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function OrderRow({ order, index }: { order: PublicOrder; index: number }) {
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
        {/* Cliente + estado + ver detalles */}
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

        {/* Productos resumen */}
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

        {/* Totales y entrega */}
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

      {/* Footer Acciones */}
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

export function WhatsAppInbox() {
  const { data: orders = [], isLoading } = useGetPublicOrdersQuery();
  const [filter, setFilter] = useState<"pending" | "contacted" | "archived">("pending");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const filtered = orders.filter((o) => {
    if (filter === "archived") return o.archived;
    if (o.archived) return false;

    if (filter === "pending") return !o.contacted;
    if (filter === "contacted") return o.contacted;
    return true;
  });

  const pendingCount = orders.filter((o) => !o.contacted && !o.archived).length;

  return (
    <RequireRole allowed={["admin"]}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight text-text">Pedidos por WhatsApp</h2>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                title="Configuración de Delivery"
                className="rounded-full p-2 bg-surface-2 text-muted hover:text-text hover:bg-surface-3 transition-colors"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted mt-1">
              Gestiona y da seguimiento a los pedidos entrantes del catálogo público
            </p>
          </div>
          {pendingCount > 0 && (
            <div className="inline-flex items-center gap-2 rounded-pill border border-warning/25 bg-warning/10 px-3.5 py-1.5 text-sm font-bold text-warning">
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
                  layoutId="whatsappInboxTabs"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent"
                />
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-card bg-surface-2" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center gap-4 py-24 text-center rounded-card border border-dashed border-border bg-surface-2/30"
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
              {filtered.map((order, i) => (
                <OrderRow key={order.id} order={order} index={i} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <DeliverySettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </RequireRole>
  );
}
