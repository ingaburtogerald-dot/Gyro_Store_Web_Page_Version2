// Portal CRM v2 (embudo Kanban + historial) — unificado con Bandeja de WhatsApp.
import { useState } from "react";
import { RequireRole } from "~/components/admin/RequireRole";
import { CrmPanel } from "~/components/admin/crm/CrmPanel";
import { WhatsAppInbox } from "~/components/admin/crm/WhatsAppInbox";
import { useAppSelector } from "~/store/hooks";
import { selectRoles } from "~/store/slices/authSlice";
import { cn } from "~/lib/utils";
import { motion } from "framer-motion";
import { MessageCircle, KanbanSquare } from "lucide-react";

export default function Crm() {
  const roles = useAppSelector(selectRoles);
  const isAdmin = roles.includes("admin") || roles.includes("global_admin");
  const [activeTab, setActiveTab] = useState<"whatsapp" | "crm">("whatsapp");

  return (
    <RequireRole allowed={["admin", "seller"]}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header de la sección unificada */}
        {isAdmin && (
          <div>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-black tracking-tight text-text">Gestión Comercial</h1>
              <p className="text-sm text-muted">
                Unificación de pedidos de WhatsApp y embudo de seguimientos CRM para el cierre de ventas
              </p>
            </div>
          </div>
        )}

        {/* Sistema de Pestañas Moderno */}
        {isAdmin ? (
          <div className="space-y-6">
            <div className="flex gap-2 border-b border-border pb-1">
              <button
                onClick={() => setActiveTab("whatsapp")}
                className={cn(
                  "relative flex items-center gap-2 rounded-t-xl px-4 py-2 text-sm font-medium transition-colors outline-none",
                  activeTab === "whatsapp"
                    ? "text-accent-2"
                    : "text-muted hover:text-text hover:bg-surface-2/50"
                )}
              >
                <MessageCircle className="h-4 w-4" />
                <span>Bandeja WhatsApp</span>
                {activeTab === "whatsapp" && (
                  <motion.div
                    layoutId="crmActiveTabs"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent"
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab("crm")}
                className={cn(
                  "relative flex items-center gap-2 rounded-t-xl px-4 py-2 text-sm font-medium transition-colors outline-none",
                  activeTab === "crm"
                    ? "text-accent-2"
                    : "text-muted hover:text-text hover:bg-surface-2/50"
                )}
              >
                <KanbanSquare className="h-4 w-4" />
                <span>Tablero Kanban</span>
                {activeTab === "crm" && (
                  <motion.div
                    layoutId="crmActiveTabs"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent"
                  />
                )}
              </button>
            </div>

            <div className="mt-4">
              {activeTab === "whatsapp" ? <WhatsAppInbox /> : <CrmPanel />}
            </div>
          </div>
        ) : (
          /* Si no es admin, solo vendedor: render directo del Kanban */
          <div className="mt-4">
            <CrmPanel />
          </div>
        )}
      </div>
    </RequireRole>
  );
}
