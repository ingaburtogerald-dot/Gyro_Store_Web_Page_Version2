// Renderizador ÚNICO de KPIs (genérico — ventas y reportes). Recibe una LISTA
// declarativa de tarjetas; cada superficie arma su array desde su dominio y este
// componente unifica estilo, stagger y formato. El grid (nº de columnas), el atenuado
// de refetch y la re-animación por estado los controla quien lo usa vía props/wrapper.
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { StatCard, type StatCardColor } from "~/components/ui/StatCard";
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
}

export function KpiGrid({ cards, className, dimmed = false }: Props) {
  return (
    <motion.div
      animate={{ opacity: dimmed ? 0.55 : 1 }}
      transition={{ duration: 0.2 }}
      className={cn("grid gap-3", className)}
    >
      {cards.map((c, i) => (
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
}
