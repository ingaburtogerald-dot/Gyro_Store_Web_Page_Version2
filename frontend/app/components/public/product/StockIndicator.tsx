// Indicador de disponibilidad compartido. El producto calcula el tono desde el
// stock real; el combo pasa tono "ok" con su etiqueta de entrega inmediata. Mismos
// tokens de color en ambos (antes el combo usaba verde WhatsApp suelto).
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";
import { itemFade } from "~/lib/detailMotion";

export type StockTone = "ok" | "low" | "out";

export function StockIndicator({ tone, label }: { tone: StockTone; label: string }) {
  return (
    <motion.p
      variants={itemFade}
      className={cn(
        "mt-3 inline-flex items-center gap-2 text-sm font-medium",
        tone === "out" ? "text-danger" : tone === "low" ? "text-warning" : "text-muted",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "out" ? "bg-danger" : tone === "low" ? "bg-warning" : "bg-whatsapp",
        )}
      />
      <span>{label}</span>
    </motion.p>
  );
}
