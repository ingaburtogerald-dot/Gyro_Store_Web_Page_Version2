// Tarjeta con "spotlight" que sigue el cursor: un resplandor radial del color de
// acento aparece bajo el mouse y un borde se ilumina. Efecto tipo Linear/Vercel.
// Respeta prefers-reduced-motion (sin resplandor).
// La posición se escribe como variables CSS directo al DOM (sin setState) para
// no re-renderizar la tarjeta en cada mousemove.
import { useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "~/lib/utils";

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Radio del resplandor en px. */
  radius?: number;
  /** Intensidad del color de acento (0–100). */
  intensity?: number;
}

export function SpotlightCard({
  className,
  children,
  radius = 360,
  intensity = 16,
  ...props
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
    ref.current.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      className={cn("group/spot relative overflow-hidden", className)}
      {...props}
    >
      {/* Resplandor que sigue al cursor */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300",
          !reduce && "group-hover/spot:opacity-100",
        )}
        style={{
          background: `radial-gradient(${radius}px circle at var(--spot-x, -9999px) var(--spot-y, -9999px), color-mix(in srgb, var(--color-accent) ${intensity}%, transparent), transparent 65%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
