// Contenedor visual común de los widgets del Bento + skeletons + variantes de
// animación compartidas (aparición escalonada). Mantiene el look consistente y
// evita repetir glass/rounded-card/cabecera en cada widget.
import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";

// ── Stagger: el grid orquesta, cada item entra con un pequeño retraso en cascada ──
export const bentoContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

export const bentoItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 240, damping: 26 } },
};

interface WidgetShellProps {
  title: string;
  icon?: LucideIcon;
  /** Acción a la derecha del header (link "ver todo", badge, botón…). */
  action?: ReactNode;
  /** Acento del header/icono (usa los colores del sistema). */
  tone?: "neutral" | "emerald" | "amber" | "indigo";
  className?: string;
  children: ReactNode;
}

const TONE: Record<NonNullable<WidgetShellProps["tone"]>, string> = {
  neutral: "text-muted",
  emerald: "text-accent-2",
  amber: "text-warning",
  indigo: "text-tone-indigo",
};

export function WidgetShell({ title, icon: Icon, action, tone = "neutral", className, children }: WidgetShellProps) {
  return (
    <motion.section
      variants={bentoItem}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={cn(
        "glass flex flex-col rounded-card p-5 shadow-sm transition-shadow duration-300 hover:shadow-xl hover:shadow-black/20",
        className,
      )}
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={cn("h-4 w-4", TONE[tone])} />}
          <h3 className="text-sm font-semibold tracking-wide text-text">{title}</h3>
        </div>
        {action}
      </header>
      <div className="flex-1">{children}</div>
    </motion.section>
  );
}

// ── Skeletons: imitan la FORMA del contenido (no spinners) usando .skeleton (shimmer) ──
export function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn("skeleton h-3 rounded-pill", className)} />;
}

/** Skeleton genérico de filas (para listas tipo actividad reciente). */
export function WidgetRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3">
          <div className="skeleton h-9 w-9 shrink-0 rounded-pill" />
          <div className="flex-1 space-y-2">
            <SkeletonLine className="w-2/3" />
            <SkeletonLine className="w-1/3 opacity-70" />
          </div>
          <SkeletonLine className="h-4 w-16" />
        </li>
      ))}
    </ul>
  );
}
