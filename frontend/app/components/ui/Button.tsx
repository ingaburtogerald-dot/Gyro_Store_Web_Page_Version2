// Botón reutilizable con variantes y micro-animación (Framer Motion).
import { forwardRef } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";

type Variant = "primary" | "submit" | "destructive" | "whatsapp" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  // Primaria — acento sólido brillante con texto oscuro (una sola convención en
  // toda la app: mismo look que tarjetas, buscador y toolbar). Con esmeralda el
  // texto oscuro da contraste ≈9:1 (AA holgado) donde el texto blanco fallaba.
  primary: "bg-gradient-to-b from-accent to-accent-hover shadow-md shadow-accent/20 border-t border-accent-2/20 text-bg font-semibold hover:from-accent-hover hover:to-accent hover:shadow-lg hover:shadow-accent/30 hover:-translate-y-0.5",
  // Sólido — submits dentro de modales y formularios (idéntico a primary para
  // que no haya dos "botones principales" distintos).
  submit: "bg-gradient-to-b from-accent to-accent-hover shadow-md shadow-accent/20 border-t border-accent-2/20 text-bg font-semibold hover:from-accent-hover hover:to-accent hover:shadow-lg hover:shadow-accent/30 hover:-translate-y-0.5",
  // Destructivo — eliminar, rechazar
  destructive: "bg-danger/10 text-danger hover:bg-danger hover:text-white hover:shadow-md hover:shadow-danger/20",
  // WhatsApp — solo para botones que abren un chat de WhatsApp real. Antes era un
  // gradiente verde casi idéntico a `primary` (ambos leían como "el mismo botón").
  // Tratamiento distinto a propósito: tinte/outline (no sólido) para que la
  // jerarquía "Agregar = acción principal" vs "WhatsApp = vía alterna" se lea
  // al instante, tanto inline como en la barra fija móvil.
  whatsapp: "border-2 border-whatsapp bg-whatsapp/10 text-whatsapp font-semibold hover:bg-whatsapp/20 hover:border-whatsapp hover:shadow-md hover:shadow-whatsapp/20 hover:-translate-y-0.5",
  ghost: "bg-transparent text-muted hover:text-text hover:bg-surface-2",
  outline: "border border-border text-text hover:bg-surface-2 hover:shadow-sm",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3 text-base",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled || loading ? {} : { scale: 0.98, y: 1 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      disabled={disabled || loading}
      className={cn(
        "ease-expo inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...(props as any)}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </motion.button>
  );
});
