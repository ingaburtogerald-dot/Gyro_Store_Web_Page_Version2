// Botón-ícono canónico del storefront — fuente ÚNICA para lupa, carrito, favorito,
// compartir, menú, etc. Antes cada header (PublicHeader, ProductTopNav) definía su
// propio IconButton con hover/focus/tamaño distintos; esto los unifica:
//   · 44×44 (target táctil WCAG 2.5.5), círculo, ícono como children.
//   · reposo text-muted → hover text-accent-2 + fondo surface-hover (look de marca).
//   · tactile push (whileTap) + focus-visible ring de acento.
// El ícono va como children para no acoplar la API a una prop `icon`.
import { forwardRef } from "react";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** aria-label + title (obligatorio: un botón-ícono no tiene texto visible). */
  label: string;
  /** Estado activo/presionado (ej. búsqueda abierta): fondo encendido permanente. */
  active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active, className, children, disabled, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        active ? "bg-surface-hover text-accent-2" : "text-muted hover:bg-surface-hover hover:text-accent-2",
        className,
      )}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
});
