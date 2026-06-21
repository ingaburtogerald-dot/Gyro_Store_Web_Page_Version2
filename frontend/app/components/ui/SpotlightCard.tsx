// Tarjeta con "spotlight" que sigue el cursor: un resplandor radial del color de
// acento aparece bajo el mouse y un borde se ilumina. Efecto tipo Linear/Vercel.
// Respeta prefers-reduced-motion (sin movimiento, pero mantiene el realce).
import { useRef, useState } from "react";
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
  const [pos, setPos] = useState({ x: -9999, y: -9999 });
  const [active, setActive] = useState(false);

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduce) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      className={cn("group/spot relative overflow-hidden", className)}
      {...props}
    >
      {/* Resplandor que sigue al cursor */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
        style={{
          opacity: active && !reduce ? 1 : 0,
          background: `radial-gradient(${radius}px circle at ${pos.x}px ${pos.y}px, color-mix(in srgb, var(--color-accent) ${intensity}%, transparent), transparent 65%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
