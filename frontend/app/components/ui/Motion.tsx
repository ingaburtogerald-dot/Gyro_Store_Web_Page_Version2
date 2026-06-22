// Primitivas de animación reutilizables (Nivel 1 del sistema visual).
// Todas respetan prefers-reduced-motion: si el usuario reduce animaciones, se renderiza
// el contenido estático. Solo animamos transform/opacity (fluido en móvil).
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
};

// Contenedor que hace entrar a sus hijos en cascada (stagger).
export function StaggerList({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={container} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

// Cada elemento de una StaggerList.
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}

// Transición suave al cambiar de pestaña. `id` debe cambiar con cada pestaña activa.
export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <div>{children}</div>;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
