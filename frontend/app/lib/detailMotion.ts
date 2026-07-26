// Variantes de animación compartidas por las páginas de detalle (producto y combo),
// para que ambas usen exactamente el mismo stagger y fade de entrada.
import type { Variants } from "framer-motion";

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

export const itemFade: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0 },
};
