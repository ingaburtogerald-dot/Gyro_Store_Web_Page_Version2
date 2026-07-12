/**
 * TableFilters — Barra de filtros reutilizable para tablas administrativas.
 *
 * Expone:
 *   - SearchInput: input de búsqueda self-contained con botón de limpiar.
 *   - TableFilterBar: wrapper completo con icono "Filtros", slots para
 *     controles adicionales (fecha, vendedor, etc.) y un action slot opcional.
 */
import { Search, X, SlidersHorizontal } from "lucide-react";
import { cn } from "~/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// SearchInput
// ─────────────────────────────────────────────────────────────────────────────
interface SearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder = "Buscar…", className }: SearchInputProps) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 rounded-pill border border-border bg-surface-2 px-3 py-1.5",
        "transition-colors focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/20",
        "sm:w-64",
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
          className="shrink-0 text-muted hover:text-text"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TableFilterBar
// ─────────────────────────────────────────────────────────────────────────────
interface TableFilterBarProps {
  /** Controles de filtrado (date picker, select de vendedor, etc.) */
  children: React.ReactNode;
  /** Acciones secundarias alineadas a la derecha (botón "Nueva venta", etc.) */
  actions?: React.ReactNode;
  /** Etiqueta izquierda. Por defecto "Filtros". */
  label?: string;
  className?: string;
}

export function TableFilterBar({ children, actions, label = "Filtros", className }: TableFilterBarProps) {
  return (
    <div
      className={cn(
        "relative z-40 flex flex-wrap items-center gap-3 border-b border-border/60 pb-4",
        className,
      )}
    >
      <span className="mr-auto hidden items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted sm:inline-flex">
        <SlidersHorizontal className="h-4 w-4" />
        {label}
      </span>

      {children}

      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}
