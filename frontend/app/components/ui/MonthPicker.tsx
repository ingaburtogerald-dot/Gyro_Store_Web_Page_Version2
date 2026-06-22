// Selector de mes propio (reemplaza el <input type="month"> nativo, que no se puede
// estilizar). Tematizado con los tokens de la app. Trabaja con strings "YYYY-MM".
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";

const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTHS_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function parseYm(s?: string): { year: number; month: number } | null {
  if (!s) return null;
  const [y, m] = s.split("-").map(Number);
  if (!y || !m) return null;
  return { year: y, month: m - 1 };
}

export interface MonthPickerProps {
  value?: string; // "YYYY-MM"
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

export function MonthPicker({ value, onChange, placeholder = "Selecciona un mes", id }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const sel = parseYm(value);
  const [viewYear, setViewYear] = useState(sel?.year ?? new Date().getFullYear());
  const ref = useRef<HTMLDivElement>(null);
  const now = new Date();

  // Al cambiar el valor, sincroniza el año mostrado.
  useEffect(() => {
    const p = parseYm(value);
    if (p) setViewYear(p.year);
  }, [value]);

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

  function pick(monthIdx: number) {
    onChange(`${viewYear}-${String(monthIdx + 1).padStart(2, "0")}`);
    setOpen(false);
  }

  const display = sel ? `${MONTHS_LONG[sel.month]} ${sel.year}` : "";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        className="input flex items-center justify-between text-left"
      >
        <span className={cn(!sel && "text-muted")}>{display || placeholder}</span>
        <CalendarIcon className="ml-2 h-4 w-4 shrink-0 text-muted" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 z-50 mt-2 w-64 rounded-card border border-border bg-surface p-3 shadow-2xl"
          >
            {/* Navegación de año */}
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewYear((y) => y - 1)}
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text"
                aria-label="Año anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-bold text-text">{viewYear}</span>
              <button
                type="button"
                onClick={() => setViewYear((y) => y + 1)}
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text"
                aria-label="Año siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Grilla de meses */}
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS_SHORT.map((m, i) => {
                const isSel = sel && sel.year === viewYear && sel.month === i;
                const isCurrent = now.getFullYear() === viewYear && now.getMonth() === i;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pick(i)}
                    className={cn(
                      "rounded-lg py-2 text-sm font-medium transition-colors",
                      isSel
                        ? "bg-gradient-accent text-white"
                        : isCurrent
                          ? "border border-accent-2/40 text-accent-2 hover:bg-surface-2"
                          : "text-muted hover:bg-surface-2 hover:text-text",
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                const d = new Date();
                onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
                setOpen(false);
              }}
              className="mt-3 w-full rounded-lg py-1.5 text-xs font-semibold text-accent-2 transition-colors hover:bg-surface-2"
            >
              Este mes
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
