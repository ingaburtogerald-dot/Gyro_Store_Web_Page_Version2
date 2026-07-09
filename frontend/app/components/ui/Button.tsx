// Botón reutilizable con variantes y micro-animación (Framer Motion).
import { forwardRef } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";

type Variant = "primary" | "submit" | "destructive" | "whatsapp" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  // Gradiente — CTAs de página (Nueva venta, Registrar compra…)
  primary: "bg-gradient-accent text-white shadow-lg shadow-accent/20",
  // Sólido — submits dentro de modales y formularios secundarios.
  // Hover oscurece (patrón Vercel): el botón se "hunde" al pasar el mouse.
  submit: "bg-accent text-white hover:bg-accent-hover shadow-md shadow-accent/20",
  // Destructivo — eliminar, rechazar
  destructive: "bg-danger/10 text-danger hover:bg-danger hover:text-white",
  // WhatsApp — solo para botones que abren un chat de WhatsApp real
  whatsapp: "bg-whatsapp text-[#04201a] font-semibold",
  ghost: "bg-transparent text-muted hover:text-text hover:bg-surface-2",
  outline: "border border-border text-text hover:bg-surface-2",
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
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-pill font-medium transition-colors",
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
