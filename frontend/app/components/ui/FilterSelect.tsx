// Dropdown de filtro estilizado (reemplazo del <select> nativo).
// Soporta un "punto" indicador por opción (p. ej. vendedores con ventas pendientes).
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "~/lib/utils";

export interface FilterSelectOption {
  value: string;
  label: string;
  /** Si es true, muestra un punto indicador junto a la opción. */
  dot?: boolean;
}

export interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  placeholder?: string;
  /** Tooltip del punto indicador (accesibilidad). */
  dotTitle?: string;
  /** Ícono opcional a la izquierda del valor (da identidad visual al filtro). */
  icon?: React.ReactNode;
}

export function FilterSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccionar",
  dotTitle,
  icon,
}: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const Dot = () => (
    <span
      title={dotTitle}
      className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.7)]"
    />
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "input flex items-center gap-2 text-left transition-all duration-200",
          open && "border-accent/30",
        )}
      >
        <span className="flex flex-1 items-center gap-2 truncate text-sm">
          {icon && <span className="shrink-0 text-accent-2">{icon}</span>}
          {selected?.dot && <Dot />}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 right-0 z-50 mt-2 max-h-64 overflow-y-auto rounded-card border border-border bg-surface p-1 shadow-2xl"
          >
            {options.map((o) => {
              const isSel = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    isSel ? "bg-accent/10 text-text" : "text-muted hover:bg-surface-2 hover:text-text",
                  )}
                >
                  {/* Reservar el ancho del punto siempre, para que los nombres queden alineados */}
                  {o.dot ? <Dot /> : <span className="h-1.5 w-1.5 shrink-0" />}
                  <span className="flex-1 truncate">{o.label}</span>
                  {isSel && <Check className="h-3.5 w-3.5 shrink-0 text-accent-2" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
