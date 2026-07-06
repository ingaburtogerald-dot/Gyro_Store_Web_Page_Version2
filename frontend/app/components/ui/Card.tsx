// Card base del sistema de diseño: superficie + borde + radio + sombra premium
// unificados. Usarla en vez de repetir "rounded-card border border-border
// bg-surface" a mano garantiza que todo el admin comparta la misma elevación.
import { cn } from "~/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Realza borde y fondo al pasar el mouse (cards clickeables / listas). */
  interactive?: boolean;
}

export function Card({ interactive = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-surface shadow-premium",
        interactive && "transition-colors hover:border-white/10 hover:bg-surface-hover",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Encabezado estándar: título + acción opcional a la derecha. */
export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-border px-5 py-4", className)}>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-text">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
