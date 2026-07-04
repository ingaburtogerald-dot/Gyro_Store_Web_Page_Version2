// Panel de registro colapsable. Un botón "+ Registrar" despliega (animado) un panel con
// un selector segmentado Pérdida/Gasto y el formulario correspondiente. Mantiene la
// vista limpia: el formulario no ocupa espacio hasta que se necesita.
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { SubTab } from "./_shared/SubTab";
import { LossForm } from "./losses/LossForm";
import { ExpenseForm } from "./expenses/ExpenseForm";

export function RegisterPanel() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"loss" | "expense">("loss");

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md transition-all",
          open ? "bg-surface-2 text-muted hover:text-text" : "bg-gradient-accent shadow-accent/20 hover:shadow-lg hover:shadow-accent/30",
        )}
      >
        {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        <span>{open ? "Cerrar" : "Registrar movimiento"}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-3">
              <div className="flex gap-1 rounded-pill border border-border bg-surface p-1 sm:w-fit">
                <SubTab active={type === "loss"} onClick={() => setType("loss")}>Pérdida de producto</SubTab>
                <SubTab active={type === "expense"} onClick={() => setType("expense")}>Gasto</SubTab>
              </div>
              {type === "loss" ? <LossForm /> : <ExpenseForm />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
