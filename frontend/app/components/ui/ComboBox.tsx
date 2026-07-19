// Combobox genérico (reemplaza <select> nativos). Botón disparador con ícono
// grande opcional + popover con búsqueda. Cierra con clic fuera o Escape
// (mismo patrón que UserMenu.tsx). `position: absolute` ancla al propio wrapper
// `relative`, así que convive bien dentro de contenedores con scroll (drawers).
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "~/lib/utils";

export interface ComboBoxOption {
  value: string;
  label: string;
  /** Emoji o ícono pequeño — se muestra grande en el disparador y en la lista. */
  icon?: React.ReactNode;
  description?: string;
}

export function ComboBox({
  options,
  value,
  onChange,
  placeholder = "Selecciona…",
  searchPlaceholder = "Buscar…",
  emptyText = "Sin resultados.",
  disabled,
  invalid,
}: {
  options: ComboBoxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) || null;
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const focusTimer = setTimeout(() => searchRef.current?.focus(), 30);
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border bg-surface-2/50 px-3.5 py-2.5 text-left transition-all",
          "focus-visible:outline-none",
          open
            ? "border-accent ring-2 ring-accent/25"
            : invalid
              ? "border-danger"
              : "border-white/10 hover:border-white/20",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        {selected?.icon && (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent/10 text-2xl">
            {selected.icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          {selected ? (
            <span className="block truncate text-sm font-semibold text-text">{selected.label}</span>
          ) : (
            <span className="block truncate text-sm text-muted">{placeholder}</span>
          )}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform duration-200", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            role="listbox"
            className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-surface-2/95 shadow-2xl shadow-black/50 backdrop-blur-xl"
          >
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-sm text-text outline-none placeholder:text-muted"
              />
            </div>
            <div className="custom-scrollbar max-h-64 overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted">{emptyText}</p>
              ) : (
                filtered.map((o) => {
                  const active = o.value === value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => pick(o.value)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                        active ? "bg-accent/12" : "hover:bg-white/5",
                      )}
                    >
                      {o.icon && (
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-lg">
                          {o.icon}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm font-medium", active ? "text-accent-2" : "text-text")}>
                          {o.label}
                        </span>
                        {o.description && <span className="block truncate text-xs text-muted">{o.description}</span>}
                      </span>
                      {active && <Check className="h-4 w-4 shrink-0 text-accent-2" />}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
