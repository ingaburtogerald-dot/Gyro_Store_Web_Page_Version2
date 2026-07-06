// Campo de formulario etiquetado con mensaje de error/advertencia. Componente
// compartido por TODOS los formularios del admin (modales, forms inline, etc.).
import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

export function Field({
  label,
  error,
  warn,
  className,
  children,
}: {
  label: string;
  error?: string;
  warn?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
      {!error && warn && <span className="mt-1 block text-xs text-amber-400">⚠ {warn}</span>}
    </label>
  );
}
