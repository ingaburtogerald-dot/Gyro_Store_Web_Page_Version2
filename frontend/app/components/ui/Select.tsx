// Select "premium" reutilizado en la reportería (header + formularios). Envuelve un
// <select> nativo (para que react-hook-form siga funcionando con {...register()} y con
// value/onChange controlado) y le da apariencia limpia: sin flecha nativa, chevron
// animado, icono opcional a la izquierda y estados hover/focus con el color accent.
import { forwardRef } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";

interface Props extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: LucideIcon;
}

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { className, children, icon: Icon, ...props },
  ref,
) {
  return (
    <div className="group relative">
      {Icon && (
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted transition-colors group-focus-within:text-accent" />
      )}
      <select
        ref={ref}
        className={cn(
          "w-full cursor-pointer appearance-none rounded-xl border border-border bg-surface-2/60 py-2.5 text-sm font-medium text-text outline-none",
          "transition-all duration-200 hover:border-accent/40 hover:bg-surface-2",
          "focus:border-accent focus:ring-2 focus:ring-accent/20",
          Icon ? "pl-9 pr-9" : "pl-3 pr-9",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted transition-all duration-200 group-focus-within:rotate-180 group-focus-within:text-accent" />
    </div>
  );
});
