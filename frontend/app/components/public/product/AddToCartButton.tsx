// Botón "Agregar" compartido con la micro-animación de estado (carrito → check).
// Antes estaba copiado 3 veces (panel producto, panel combo, barra flotante) con
// alturas y tokens de "negro" distintos. Aquí: altura vía prop, éxito en text-bg.
import { AnimatePresence, motion } from "framer-motion";
import { Check, ShoppingCart } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { cn } from "~/lib/utils";

export function AddToCartButton({
  isAdded,
  onClick,
  disabled,
  idleLabel,
  addedLabel = "¡Agregado!",
  heightClass = "h-11 sm:h-12",
  className,
}: {
  isAdded: boolean;
  onClick: () => void;
  disabled?: boolean;
  idleLabel: string;
  addedLabel?: string;
  heightClass?: string;
  className?: string;
}) {
  return (
    <Button
      variant="primary"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full overflow-hidden",
        heightClass,
        isAdded && "bg-whatsapp hover:bg-whatsapp border-transparent text-bg",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isAdded ? "added" : "idle"}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2"
        >
          {isAdded ? <Check className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
          {isAdded ? addedLabel : idleLabel}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
