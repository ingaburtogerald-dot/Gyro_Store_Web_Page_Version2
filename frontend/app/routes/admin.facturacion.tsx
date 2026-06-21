// Portal de Facturación: generar tickets POS 80mm e historial de tickets.
import { useState } from "react";
import { motion } from "framer-motion";
import { RequireRole } from "~/components/admin/RequireRole";
import { TicketBuilder } from "~/components/admin/invoices/TicketBuilder";
import { InvoicesList } from "~/components/admin/invoices/InvoicesList";
import { cn } from "~/lib/utils";

type Tab = "generate" | "history";

export default function Facturacion() {
  const [tab, setTab] = useState<Tab>("generate");

  return (
    <RequireRole allowed={["admin", "cashier"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Facturación</h1>
          <p className="text-muted">Genera tickets térmicos POS 80mm y consulta el historial.</p>
        </div>

        <div className="flex gap-1 rounded-pill border border-border bg-surface p-1 sm:w-fit">
          <TabBtn active={tab === "generate"} onClick={() => setTab("generate")}>Generar ticket</TabBtn>
          <TabBtn active={tab === "history"} onClick={() => setTab("history")}>Historial</TabBtn>
        </div>

        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          {tab === "generate" ? <TicketBuilder /> : <InvoicesList />}
        </motion.div>
      </div>
    </RequireRole>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded-pill px-4 py-2 text-sm font-medium transition-colors sm:flex-none",
        active ? "bg-gradient-accent text-white" : "text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
