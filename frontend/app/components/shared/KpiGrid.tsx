// Renderizador ÚNICO de KPIs (genérico — ventas y reportes). Recibe una LISTA
// declarativa de tarjetas; cada superficie arma su array desde su dominio y este
// componente unifica estilo, stagger y formato. El grid (nº de columnas), el atenuado
// de refetch y la re-animación por estado los controla quien lo usa vía props/wrapper.
//
// Modo BENTO (opcional): si se pasa `featuredKey`, esa tarjeta se extrae a una
// banda héroe con tipografía estelar (el dinero que importa se ve "caro"); el
// resto fluye en la grilla secundaria. Sin `featuredKey` el render es el de
// siempre (retrocompatible con reportes y demás consumidores).
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { StatCard, type StatCardColor } from "~/components/ui/Card";
import { CountUp } from "~/components/ui/CountUp";
import { formatCordobas, usdFromCordobas, cn } from "~/lib/utils";

export interface KpiCardSpec {
  key: string;
  icon: LucideIcon;
  label: string;
  value: number;
  /** true → formatea en córdobas y agrega el sub en USD; false → número crudo (conteos). */
  money?: boolean;
  color?: StatCardColor;
}

interface Props {
  cards: KpiCardSpec[];
  /** Definición completa de columnas del grid (cada superficie pasa su responsivo
   *  exacto, p. ej. "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"). */
  className?: string;
  /** Atenúa durante un refetch (evita el "salto a cero"). */
  dimmed?: boolean;
  /** Si se indica, esa tarjeta sube a una banda héroe (bento). */
  featuredKey?: string;
}

export function KpiGrid({ cards, className, dimmed = false, featuredKey }: Props) {
  const hero = featuredKey ? cards.find((c) => c.key === featuredKey) : undefined;
  const rest = hero ? cards.filter((c) => c.key !== hero.key) : cards;

  const grid = (
    <motion.div
      animate={{ opacity: dimmed ? 0.55 : 1 }}
      transition={{ duration: 0.2 }}
      className={cn("grid gap-3", className)}
    >
      {rest.map((c, i) => (
        <StatCard
          key={c.key}
          icon={c.icon}
          label={c.label}
          countTo={c.value}
          format={c.money ? formatCordobas : undefined}
          sub={c.money ? usdFromCordobas(c.value) : undefined}
          color={c.color}
          delay={i * 0.05}
        />
      ))}
    </motion.div>
  );

  if (!hero) return grid;

  return (
    <div className="space-y-3">
      <HeroKpi card={hero} dimmed={dimmed} />
      {grid}
    </div>
  );
}

/** Banda héroe: el número estelar (Sora, tabular-nums, acento) + su valor en USD. */
function HeroKpi({ card, dimmed }: { card: KpiCardSpec; dimmed: boolean }) {
  const Icon = card.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: dimmed ? 0.55 : 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="relative overflow-hidden rounded-card border border-accent/20 bg-accent/[0.06] p-5 sm:p-6"
    >
      {/* Halo radial sutil detrás del número */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/15 blur-3xl"
        aria-hidden
      />
      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent-2">
            <Icon className="h-4 w-4" />
            {card.label}
          </p>
          <p className="mt-2 font-heading text-3xl font-bold tabular-nums leading-none text-accent-2 sm:text-4xl lg:text-5xl">
            <CountUp value={card.value} format={card.money ? formatCordobas : undefined} />
          </p>
          {card.money && (
            <p className="mt-1.5 text-sm tabular-nums text-muted">{usdFromCordobas(card.value)}</p>
          )}
        </div>
        <div className="hidden shrink-0 rounded-2xl bg-accent/10 p-4 text-accent-2 sm:block">
          <Icon className="h-7 w-7" />
        </div>
      </div>
    </motion.div>
  );
}
