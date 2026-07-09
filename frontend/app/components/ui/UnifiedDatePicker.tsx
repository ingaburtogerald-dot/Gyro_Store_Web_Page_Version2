// Selector de fecha unificado — un solo trigger abre un popup con toggle Mes / Día.
// En modo "Mes" muestra la grilla de meses; en modo "Día" muestra el calendario diario.
// Retorna: "" | "YYYY-MM" | "YYYY-MM-DD". El padre no necesita conocer el modo activo.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import { es } from "react-day-picker/locale";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "~/lib/utils";

const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTHS_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function parseYmd(s?: string): Date | undefined {
  if (!s || s.length !== 10) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseYm(s?: string): { year: number; month: number } | null {
  if (!s || s.length !== 7) return null;
  const [y, m] = s.split("-").map(Number);
  if (!y || !m) return null;
  return { year: y, month: m - 1 };
}

function displayLabel(value: string): string {
  if (!value || value === "all") return "";
  if (value.length === 7) {
    const p = parseYm(value);
    return p ? `${MONTHS_LONG[p.month]} ${p.year}` : "";
  }
  if (value.length === 10) {
    const d = parseYmd(value);
    return d ? d.toLocaleDateString("es-NI", { day: "2-digit", month: "short", year: "numeric" }) : "";
  }
  return "";
}

export interface UnifiedDatePickerProps {
  value: string; // "" | "all" | "YYYY-MM" | "YYYY-MM-DD"
  onChange: (value: string) => void;
  placeholder?: string;
  align?: "left" | "right";
}

export function UnifiedDatePicker({
  value,
  onChange,
  placeholder = "Todo el tiempo",
  align = "left",
}: UnifiedDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [mode, setMode] = useState<"month" | "day">("month");
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const ref = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const now = new Date();

  const label = displayLabel(value);
  const hasValue = !!label;

  // Sincroniza el año visible y el modo cuando el padre cambia el valor
  useEffect(() => {
    if (value.length === 7) {
      const p = parseYm(value);
      if (p) setViewYear(p.year);
      setMode("month");
    } else if (value.length === 10) {
      const d = parseYmd(value);
      if (d) setViewYear(d.getFullYear());
      setMode("day");
    } else {
      setViewYear(now.getFullYear());
    }
  }, [value]);

  const CAL_W = 260;
  const CAL_H = 380;

  function computeCoords() {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let top = r.bottom + 8;
    if (top + CAL_H > window.innerHeight && r.top - CAL_H - 8 > 0) top = r.top - CAL_H - 8;
    let left = align === "right" ? r.right - CAL_W : r.left;
    if (left + CAL_W > window.innerWidth - 8) left = Math.max(8, window.innerWidth - CAL_W - 8);
    setCoords({ top, left });
  }

  useEffect(() => {
    if (!open) return;
    computeCoords();
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    window.addEventListener("scroll", computeCoords, true);
    window.addEventListener("resize", computeCoords);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
      window.removeEventListener("scroll", computeCoords, true);
      window.removeEventListener("resize", computeCoords);
    };
  }, [open, align]);

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("all");
  }

  function pickMonth(monthIdx: number) {
    onChange(`${viewYear}-${String(monthIdx + 1).padStart(2, "0")}`);
    setOpen(false);
  }

  const selectedDay = parseYmd(value);
  const selectedMonth = parseYm(value);

  return (
    <div className="relative">
      <button
        type="button"
        ref={ref}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-2 rounded-pill border border-border bg-surface-2 px-4 py-2 text-left text-sm text-text transition-all duration-200 hover:bg-surface-2/80 focus:outline-none focus:ring-2 focus:ring-accent/20",
          hasValue && "border-accent/50 bg-accent/5 text-accent-2",
          open && !hasValue && "border-accent/50 ring-2 ring-accent/20",
        )}
      >
        <CalendarIcon
          className={cn("h-4 w-4 shrink-0 transition-colors", hasValue ? "text-accent-2" : "text-muted")}
        />
        <span className={cn("flex-1 truncate text-sm", !hasValue && "text-muted")}>
          {label || placeholder}
        </span>
        {hasValue && (
          <span
            role="button"
            onClick={clear}
            className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text"
            aria-label="Limpiar fecha"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && coords && (
              <motion.div
                ref={popoverRef}
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                className="z-[100] overflow-hidden rounded-card border border-border bg-surface shadow-2xl"
                style={{ position: "fixed", top: coords.top, left: coords.left, minWidth: 252 }}
              >
            {/* Toggle Mes / Día */}
            <div className="border-b border-border/60 p-3 pb-0">
              <div className="mb-3 flex items-center gap-1 rounded-pill border border-border bg-bg p-1">
                {(["month", "day"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={cn(
                      "flex-1 rounded-pill py-1.5 text-xs font-semibold transition-colors",
                      mode === m ? "bg-gradient-accent text-white shadow-sm" : "text-muted hover:text-text",
                    )}
                  >
                    {m === "month" ? "Mes" : "Día"}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3">
              {mode === "month" ? (
                <>
                  {/* Navegación de año */}
                  <div className="mb-2 flex items-center justify-between">
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
                      const isSel = selectedMonth && selectedMonth.year === viewYear && selectedMonth.month === i;
                      const isCurrent = now.getFullYear() === viewYear && now.getMonth() === i;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => pickMonth(i)}
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
                      onChange(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
                      setOpen(false);
                    }}
                    className="mt-2 w-full rounded-lg py-1.5 text-xs font-semibold text-accent-2 transition-colors hover:bg-surface-2"
                  >
                    Este mes
                  </button>
                </>
              ) : (
                <DayPicker
                  mode="single"
                  locale={es}
                  selected={selectedDay}
                  defaultMonth={selectedDay ?? now}
                  onSelect={(d) => {
                    if (d) {
                      onChange(toYmd(d));
                      setOpen(false);
                    }
                  }}
                  className="app-daypicker"
                />
              )}
            </div>

            {hasValue && (
              <div className="border-t border-border/60 px-3 pb-3">
                <button
                  type="button"
                  onClick={() => {
                    onChange("all");
                    setOpen(false);
                  }}
                  className="mt-2 w-full rounded-lg border border-border/60 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-text"
                >
                  Limpiar filtro
                </button>
              </div>
            )}
          </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
