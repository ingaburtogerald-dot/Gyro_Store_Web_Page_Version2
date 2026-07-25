import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, PhoneForwarded } from "lucide-react";
import { formatCordobas } from "~/lib/utils";
import { useGetFullConfigQuery } from "~/store/api/salesApi";
import type { PublicOrder } from "~/store/api/salesApi";

export function PublicOrderModal({ order, open, onClose }: { order: PublicOrder; open: boolean; onClose: () => void }) {
  const { data: config } = useGetFullConfigQuery(undefined, { skip: !open });
  const deliveryPersonnel = config?.deliveryPersonnel || [];
  const [showDeliveryOptions, setShowDeliveryOptions] = useState(false);

  const date = order.createdAt ? new Date(order.createdAt).toLocaleString("es-NI") : "—";
  const cleanPhone = order.customerPhone.replace(/[\s\+\-]/g, "");
  
  const waText = encodeURIComponent(
    `Hola ${order.customerName.split(" ")[0]}, vimos tu pedido en Gyro Store por ${formatCordobas(order.total)}. ¿Te gustaría que coordinemos el pago y envío?`
  );
  const waLink = `https://wa.me/${cleanPhone}?text=${waText}`;

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
