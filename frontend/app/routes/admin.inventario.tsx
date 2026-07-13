// Portal de Control de Inventario.
//
// Estado basado en URL (useSearchParams) en vez de useState, para que las vistas
// sean enlazables/recargables y compartan estado con la barra de direcciones:
//   - tab    = purchases | inventory
//   - type   = current | migrated   (solo aplica si tab=inventory)
//   - period = all | YYYY-MM        (filtro global de meses)
//
// Jerarquía visual:
//   1. Cabecera con título + filtro global de meses.
//   2. Navegación principal (tabs): Registro de Compras / Inventario.
//   3. Sub-navegación SOLO en Inventario: segmented control compacto (Actual /
//      Migrado) alineado a la derecha, encima de los KPIs.
//   4. KPIs (reciben tab efectivo + period) y luego el contenido.
import { useMemo, useState } from "react";
import { useSearchParams } from "@remix-run/react";
import { motion } from "framer-motion";
import { Boxes, Archive, CalendarRange } from "lucide-react";
import { RequireRole } from "~/components/admin/RequireRole";
import { InventoryKpis } from "~/components/admin/inventory/InventoryKpis";
import { PurchaseForm } from "~/components/admin/inventory/PurchaseForm";
import { PurchasesTable } from "~/components/admin/inventory/PurchasesTable";
import { CurrentInventoryTable } from "~/components/admin/inventory/CurrentInventoryTable";
import { MigratedInventoryForm } from "~/components/admin/inventory/MigratedInventoryForm";
import { MigratedInventoryTable } from "~/components/admin/inventory/MigratedInventoryTable";
import { Modal } from "~/components/ui/Modal";
import { AnimatedTabs } from "~/components/ui/AnimatedTabs";
import { FilterSelect, type FilterSelectOption } from "~/components/ui/FilterSelect";
import { cn } from "~/lib/utils";

type MainTab = "purchases" | "inventory";
type InvType = "current" | "migrated";

const MAIN_TABS = [
  { id: "purchases", label: "Registro de Compras" },
  { id: "inventory", label: "Inventario" },
];

const INV_TYPES = [
  { value: "current", label: "Inventario Actual", icon: Boxes },
  { value: "migrated", label: "Inventario Migrado", icon: Archive },
];

// "Historial Completo" + los últimos 6 meses, etiquetados en español.
function buildMonthOptions(): FilterSelectOption[] {
  const opts: FilterSelectOption[] = [{ value: "all", label: "Historial Completo" }];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const raw = d.toLocaleDateString("es-NI", { month: "long", year: "numeric" });
    opts.push({ value, label: raw.charAt(0).toUpperCase() + raw.slice(1) });
  }
  return opts;
}

export default function Inventario() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [migratedFormOpen, setMigratedFormOpen] = useState(false);
  const [purchaseFormOpen, setPurchaseFormOpen] = useState(false);
  const monthOptions = useMemo(buildMonthOptions, []);

  // ── Lectura + normalización de los parámetros de la URL ──
  const tab: MainTab = searchParams.get("tab") === "inventory" ? "inventory" : "purchases";
  const type: InvType = searchParams.get("type") === "migrated" ? "migrated" : "current";
  const period = searchParams.get("period") || "all";

  // Vista efectiva para KPIs/contenido: en "purchases" es la de compras; en
  // "inventory" depende del segmented control.
  const effectiveView = tab === "purchases" ? "purchases" : type;

  // Actualiza la URL preservando el resto de parámetros (replace = sin ruido en el historial).
  function updateParams(updates: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(updates)) {
          if (v === null) next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true },
    );
  }

  return (
    <RequireRole allowed={["admin"]}>
      <div className="space-y-6">
        {/* 1. Cabecera + filtro global de meses */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text">Control de Inventario</h1>
            <p className="text-muted">Registro de compras en China y stock recibido en bodega.</p>
          </div>
          <div className="w-full sm:w-64">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">
              Periodo
            </label>
            <FilterSelect
              value={period}
              onChange={(p) => updateParams({ period: p })}
              options={monthOptions}
              icon={<CalendarRange className="h-4 w-4" />}
            />
          </div>
        </div>

        {/* 2. Navegación principal (sticky) */}
        <div className="sticky top-16 z-20 -mx-4 bg-bg/80 px-4 py-2 backdrop-blur md:-mx-6 md:px-6">
          <AnimatedTabs
            items={MAIN_TABS}
            value={tab}
            onChange={(id) =>
              id === "inventory" ? updateParams({ tab: "inventory", type }) : updateParams({ tab: "purchases" })
            }
            layoutId="inv-main-tabs"
          />
        </div>

        {/* 3. Sub-navegación SOLO en Inventario: segmented control a la derecha */}
        {tab === "inventory" && (
          <div className="flex justify-end">
            <SegmentedControl
              value={type}
              onChange={(t) => updateParams({ type: t })}
              options={INV_TYPES}
            />
          </div>
        )}

        {/* 4. KPIs según vista efectiva + periodo */}
        <InventoryKpis tab={effectiveView} period={period} />

        {/* Contenido */}
        <motion.div key={effectiveView} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {tab === "purchases" && (
            <>
              <PurchasesTable period={period} onOpenForm={() => setPurchaseFormOpen(true)} />

              <Modal
                open={purchaseFormOpen}
                onClose={() => setPurchaseFormOpen(false)}
                title="Registrar compra"
                maxWidth="max-w-3xl"
                preventOutsideClose={true}
              >
                <div className="max-h-[80vh] overflow-y-auto pr-1">
                  <PurchaseForm onDone={() => setPurchaseFormOpen(false)} />
                </div>
              </Modal>
            </>
          )}

          {tab === "inventory" && type === "current" && <CurrentInventoryTable period={period} />}

          {tab === "inventory" && type === "migrated" && (
            <>
              <MigratedInventoryTable period={period} onOpenForm={() => setMigratedFormOpen(true)} />

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

// Segmented control estilo iOS (distinto de los tabs principales): track hundido,
// íconos por segmento e indicador deslizante con glow (Framer layoutId).
function SegmentedControl({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon?: React.ComponentType<{ className?: string }> }[];
}) {
  return (
    <div className="inline-flex gap-1 rounded-xl border border-border bg-surface-2 p-1 shadow-inner">
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              active ? "text-white" : "text-muted hover:text-text",
            )}
          >
            {active && (
              <motion.span
                layoutId="inv-type-seg"
                className="absolute inset-0 rounded-lg bg-gradient-accent shadow-lg shadow-accent/30"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            {Icon && <Icon className="relative z-10 h-4 w-4" />}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
