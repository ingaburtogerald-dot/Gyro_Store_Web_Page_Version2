// Date picker propio (reemplaza el <input type="date"> nativo, que no se puede
// estilizar). Tematizado con los tokens de la app. Trabaja con strings
// "YYYY-MM-DD" para encajar con los formularios existentes.
//
// - DatePicker: controlado (value / onChange).
// - DateField: adaptador para react-hook-form (Controller).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import { es } from "react-day-picker/locale";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar as CalendarIcon } from "lucide-react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { cn } from "~/lib/utils";

// "YYYY-MM-DD" → Date local (sin saltos por zona horaria).
function parseYmd(s?: string): Date | undefined {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// Date → "YYYY-MM-DD" local.
function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplay(s?: string): string {
  const d = parseYmd(s);
  if (!d) return "";
  return d.toLocaleDateString("es-NI", { day: "2-digit", month: "short", year: "numeric" });
}

export interface DatePickerProps {
  value?: string; // "YYYY-MM-DD"
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
}

// Tamaño aprox. del calendario, para decidir flip arriba/abajo y clamp horizontal.
const CAL_W = 300;
const CAL_H = 340;

export function DatePicker({ value, onChange, placeholder = "Selecciona una fecha", id, invalid, disabled }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const selected = parseYmd(value);

  // Posiciona el popover (position: fixed) bajo el trigger; hace flip hacia arriba si
  // no cabe abajo y lo mantiene dentro del viewport horizontalmente.
  function computeCoords() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let top = r.bottom + 8;
    if (top + CAL_H > window.innerHeight && r.top - CAL_H - 8 > 0) top = r.top - CAL_H - 8;
    let left = r.left;
    if (left + CAL_W > window.innerWidth - 8) left = Math.max(8, window.innerWidth - CAL_W - 8);
    setCoords({ top, left });
  }

  useEffect(() => {
    if (!open) return;
    computeCoords();
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    // `true` (captura) para reaccionar a scroll de cualquier contenedor padre.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        id={id}
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className={cn("input flex items-center justify-between text-left", invalid && "!border-danger", disabled && "opacity-50 cursor-not-allowed")}
      >
        <span className={cn(!selected && "text-muted")}>{selected ? formatDisplay(value) : placeholder}</span>
        <CalendarIcon className="ml-2 h-4 w-4 shrink-0 text-muted" />
      </button>

      {/* Portal al body con position:fixed → escapa de cualquier ancestro con overflow
          (cards, modales con scroll) que recortaría un dropdown absoluto. */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && coords && (
              <motion.div
                ref={popoverRef}
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                style={{ position: "fixed", top: coords.top, left: coords.left }}
                className="z-[100] rounded-card border border-border bg-surface p-2 shadow-2xl"
              >
                <DayPicker
                  mode="single"
                  locale={es}
                  selected={selected}
                  defaultMonth={selected}
                  onSelect={(d) => {
                    if (d) {
                      onChange(toYmd(d));
                      setOpen(false);
                    }
                  }}
                  className="app-daypicker"
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

// Adaptador para react-hook-form: <DateField control={control} name="..." />.
export interface DateFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  placeholder?: string;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
}

export function DateField<T extends FieldValues>({ control, name, placeholder, id, invalid, disabled }: DateFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <DatePicker
          id={id}
          value={(field.value as string) || ""}
          onChange={field.onChange}
          placeholder={placeholder}
          invalid={invalid}
          disabled={disabled}
        />
      )}
    />
  );
}
