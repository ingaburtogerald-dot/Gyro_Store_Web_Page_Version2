// Registro de movimientos (pérdida / gasto) en un modal centrado (pop-up). El botón
// "Registrar movimiento" abre un modal con un selector segmentado Pérdida/Gasto y el
// formulario correspondiente. No empuja el contenido ni ocupa un panel lateral.
import { useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Modal } from "~/components/ui/Modal";
import { TabBtn } from "~/components/ui/TabBtn";
import { LossForm } from "./losses/LossForm";
import { ExpenseForm } from "./expenses/ExpenseForm";

export function RegisterPanel() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"loss" | "expense">("loss");

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-1.5 rounded-pill bg-gradient-accent px-4 py-2 text-sm font-semibold text-white shadow-md shadow-accent/20 transition-all duration-200 hover:shadow-lg hover:shadow-accent/30"
      >
        <Plus className="h-4 w-4" />
        <span>Registrar movimiento</span>
      </motion.button>

      <Modal open={open} onClose={() => setOpen(false)} title="Registrar movimiento" maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="flex gap-1 rounded-pill border border-border bg-surface-2/50 p-1">
            <TabBtn active={type === "loss"} onClick={() => setType("loss")}>Pérdida de producto</TabBtn>
            <TabBtn active={type === "expense"} onClick={() => setType("expense")}>Gasto</TabBtn>
          </div>
          {type === "loss" ? <LossForm bare onDone={() => setOpen(false)} /> : <ExpenseForm bare onDone={() => setOpen(false)} />}
        </div>
      </Modal>
    </>
  );
}
