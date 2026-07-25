import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Settings, Archive } from "lucide-react";
import { RequireRole } from "~/components/admin/RequireRole";
import { useGetPublicOrdersQuery } from "~/store/api/salesApi";
import { cn } from "~/lib/utils";
import { DeliverySettingsModal } from "./whatsapp/DeliverySettingsModal";
import { OrderRow } from "./whatsapp/OrderRow";

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
