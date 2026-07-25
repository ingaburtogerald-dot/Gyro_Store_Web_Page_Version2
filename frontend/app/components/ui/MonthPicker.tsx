// Selector de período unificado: un solo control que muestra "📅 Julio 2026" (o
// "Todo el año 2026") en reposo y, al abrir, un popover con stepper de año + grilla de
// 12 meses + opción "Todo el año". Reemplaza los dos <select> separados.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "~/lib/utils";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTHS_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

interface Props {
  year: number;
  month: number | "all";
  minYear: number;
  maxYear: number;
  onChange: (year: number, month: number | "all") => void;
}

export function MonthPicker({ year, month, minYear, maxYear, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draftYear, setDraftYear] = useState(year);
  const ref = useRef<HTMLDivElement>(null);

  // Al abrir, el año del popover parte del año seleccionado.
  useEffect(() => {
    if (open) setDraftYear(year);
  }, [open, year]);

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const label = month === "all" ? `Todo el año ${year}` : `${MONTHS_FULL[month]} ${year}`;

  function pick(m: number | "all") {
    onChange(draftYear, m);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "flex items-center gap-2 rounded-xl border bg-surface-2/60 py-2.5 pl-3 pr-3.5 text-sm font-semibold text-text outline-none transition-all duration-200",
          "hover:border-accent/40 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent/20",
          open ? "border-accent/50 ring-2 ring-accent/20" : "border-border",
        )}
      >
        <Calendar className="h-4 w-4 text-accent" />
        <span className="min-w-[7.5rem] text-left tabular-nums">{label}</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-2xl border border-border bg-surface p-3 shadow-2xl"
          >
            {/* Stepper de año */}
            <div className="mb-3 flex items-center justify-between">
              <StepBtn onClick={() => setDraftYear((y) => Math.max(minYear, y - 1))} disabled={draftYear <= minYear}>
                <ChevronLeft className="h-4 w-4" />
              </StepBtn>
              <span className="text-sm font-bold tracking-tight text-text tabular-nums">{draftYear}</span>
              <StepBtn onClick={() => setDraftYear((y) => Math.min(maxYear, y + 1))} disabled={draftYear >= maxYear}>
                <ChevronRight className="h-4 w-4" />
              </StepBtn>
            </div>

            {/* Grilla de meses */}
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((m, i) => {
                const selected = month === i && year === draftYear;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pick(i)}
                    className={cn(
                      "rounded-lg py-2 text-sm font-medium transition-all duration-150",
                      selected
                        ? "bg-gradient-accent text-white shadow-sm shadow-accent/30"
                        : "text-muted hover:bg-surface-2 hover:text-text",
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            {/* Todo el año */}
            <button
              type="button"
              onClick={() => pick("all")}
              className={cn(
                "mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-all duration-150",
                month === "all" && year === draftYear
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border text-muted hover:bg-surface-2 hover:text-text",
              )}
            >
              {month === "all" && year === draftYear && <Check className="h-3.5 w-3.5" />}
              Todo el año
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StepBtn({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:pointer-events-none disabled:opacity-30"
      {...props}
    >
      {children}
    </button>
  );
}
