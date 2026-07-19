// Tarjeta de sección "glass" (reemplaza el SectionCard gris genérico): fondo
// translúcido + blur, ícono con degradado. `collapsible` la vuelve un acordeón
// (modo edición); sin esa prop queda siempre expandida (un paso del wizard).
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "~/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

export function GlassSection({
  icon: Icon,
  title,
  subtitle,
  children,
  collapsible = false,
  defaultOpen = true,
  badge,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyVisible = !collapsible || open;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/5 bg-surface/40 shadow-xl shadow-black/20 backdrop-blur-md">
      <header
        onClick={collapsible ? () => setOpen((o) => !o) : undefined}
        className={cn(
          "flex items-start gap-3.5 px-5 py-4",
          collapsible && "cursor-pointer select-none transition-colors hover:bg-white/[0.03]",
        )}
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent/25 to-accent-2/10 text-accent-2 ring-1 ring-inset ring-accent/20">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="text-[15px] font-bold tracking-tight text-text">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {badge}
        {collapsible && (
          <ChevronDown className={cn("mt-1.5 h-4 w-4 shrink-0 text-muted transition-transform duration-300", open && "rotate-180")} />
        )}
      </header>
      <AnimatePresence initial={false}>
        {bodyVisible && (
          <motion.div
            initial={collapsible ? { height: 0, opacity: 0 } : false}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            <div className="space-y-4 border-t border-white/5 p-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
