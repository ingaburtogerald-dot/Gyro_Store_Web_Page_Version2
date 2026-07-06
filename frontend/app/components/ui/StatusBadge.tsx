// Badge de estado canónico: punto con glow (bg-current hereda el color del
// texto) + etiqueta en mayúsculas. Un solo lugar define los tonos semánticos
// para que "Activo/Pendiente/Anulado" se vea idéntico en todo el admin.
import { cn } from "~/lib/utils";

export type BadgeStatus = "success" | "pending" | "error" | "info" | "neutral" | "whatsapp";

const VARIANTS: Record<BadgeStatus, string> = {
  success: "border-accent/20 bg-accent/10 text-accent-2",
  pending: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  error: "border-red-500/20 bg-red-500/10 text-red-400",
  info: "border-sky-500/20 bg-sky-500/10 text-sky-400",
  neutral: "border-border bg-surface-2 text-muted",
  whatsapp: "border-whatsapp/20 bg-whatsapp/10 text-whatsapp",
};

/* Glow de contenedor (neón suave) por variante — se activa con `glow`. */
const GLOWS: Partial<Record<BadgeStatus, string>> = {
  success: "glow-emerald",
  pending: "glow-amber",
  error: "glow-rose",
  whatsapp: "glow-whatsapp",
};

export function StatusBadge({
  status,
  label,
  pulse = false,
  glow = false,
  className,
}: {
  status: BadgeStatus;
  label: React.ReactNode;
  /** Anima el punto (estados que esperan acción, ej. "pendiente"). */
  pulse?: boolean;
  /** Halo neón alrededor del badge (listas donde el estado es protagonista). */
  glow?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
        VARIANTS[status],
        glow && GLOWS[status],
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]",
          pulse && "animate-badge-pulse",
        )}
      />
      {label}
    </span>
  );
}
