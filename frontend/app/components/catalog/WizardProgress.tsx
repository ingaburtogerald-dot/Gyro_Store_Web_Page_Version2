// Barra de progreso del wizard de creación (CatalogEditorDrawer). Círculos por
// paso con check animado al completarse + barra de relleno que desliza con
// spring. Los pasos futuros/pasados son solo indicadores (no navegables): el
// avance real lo controla goNext/goBack en el drawer.
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "~/lib/utils";

export interface WizardStepMeta {
  key: string;
  label: string;
  icon: React.ElementType;
}

export function WizardProgress({
  steps,
  current,
  completed,
}: {
  steps: WizardStepMeta[];
  current: number;
  completed: Set<number>;
}) {
  const pct = steps.length > 1 ? (current / (steps.length - 1)) * 100 : 0;

  return (
    <div className="mb-5">
      <div className="mb-3 flex items-start justify-between">
        {steps.map((s, i) => {
          const done = completed.has(i);
          const active = i === current;
          return (
            <div key={s.key} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 transition-colors duration-300",
                  done
                    ? "border-accent bg-accent text-bg"
                    : active
                      ? "border-accent bg-accent/10 text-accent-2 shadow-lg shadow-accent/20"
                      : "border-white/10 bg-surface-2/50 text-muted",
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {done ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    >
                      <Check className="h-4 w-4" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="icon"
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <s.icon className="h-4 w-4" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className={cn("hidden text-center text-[11px] font-semibold sm:block", active ? "text-text" : "text-muted")}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full bg-gradient-accent"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}
