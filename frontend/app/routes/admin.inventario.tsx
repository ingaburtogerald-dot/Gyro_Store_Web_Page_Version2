// Portal de Control de Inventario: KPIs + pestañas (Registro de Compras /
// Inventario Actual / Inventario Migrado). El tab migrado es independiente:
// vive en su propia colección y no toca el inventario actual.
import { useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { RequireRole } from "~/components/admin/RequireRole";
import { InventoryKpis } from "~/components/admin/inventory/InventoryKpis";
import { PurchaseForm } from "~/components/admin/inventory/PurchaseForm";
import { PurchasesTable } from "~/components/admin/inventory/PurchasesTable";
import { CurrentInventoryTable } from "~/components/admin/inventory/CurrentInventoryTable";
import { MigratedInventoryForm } from "~/components/admin/inventory/MigratedInventoryForm";
import { MigratedInventoryTable } from "~/components/admin/inventory/MigratedInventoryTable";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { AnimatedTabs } from "~/components/ui/AnimatedTabs";

type Tab = "purchases" | "current" | "migrated";

const INV_TABS = [
  { id: "purchases", label: "Registro de Compras" },
  { id: "current", label: "Inventario Actual" },
  { id: "migrated", label: "Inventario Migrado" },
];

export default function Inventario() {
  const [tab, setTab] = useState<Tab>("purchases");
  const [migratedFormOpen, setMigratedFormOpen] = useState(false);

  return (
    <RequireRole allowed={["admin"]}>
      <div className="space-y-6">
        <div>
          <h1 className="gradient-text text-2xl font-bold">Control de Inventario</h1>
          <p className="text-muted">Registro de compras en China y stock recibido en bodega.</p>
        </div>

        <InventoryKpis tab={tab} />

        {/* Pestañas — sticky para que sigan al usuario al hacer scroll. */}
        <div className="sticky top-16 z-20 -mx-4 bg-bg/80 px-4 py-2 backdrop-blur md:-mx-6 md:px-6">
          <AnimatedTabs
            items={INV_TABS}
            value={tab}
            onChange={(id) => setTab(id as Tab)}
            layoutId="inv-tabs"
          />
        </div>

        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {tab === "purchases" && (
            <>
              <PurchaseForm />
              <PurchasesTable />
            </>
          )}
          {tab === "current" && <CurrentInventoryTable />}
          {tab === "migrated" && (
            <>
              <MigratedInventoryTable onOpenForm={() => setMigratedFormOpen(true)} />

              <Modal
                open={migratedFormOpen}
                onClose={() => setMigratedFormOpen(false)}
                title="Registrar ítem migrado"
                maxWidth="max-w-3xl"
                preventOutsideClose={true}
              >
                <div className="max-h-[80vh] overflow-y-auto pr-1">
                  <MigratedInventoryForm onDone={() => setMigratedFormOpen(false)} />
                </div>
              </Modal>
            </>
          )}
        </motion.div>
      </div>
    </RequireRole>
  );
}
