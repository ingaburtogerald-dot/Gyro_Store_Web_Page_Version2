import { motion } from "framer-motion";
import { cn, formatCordobas } from "~/lib/utils";

export function NotifRow({
  avatar,
  title,
  subtitle,
  right,
  onClick,
  titleClass,
}: {
  avatar: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onClick: () => void;
  titleClass?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2/60"
    >
      {avatar}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm font-semibold text-text", titleClass)}>{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-xs text-muted">{subtitle}</span>}
      </span>
      {right && <span className="shrink-0 self-center">{right}</span>}
    </motion.button>
  );
}

export function Money({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("shrink-0 text-[11px] font-medium tabular-nums text-muted", className)}>
      {formatCordobas(value)}
    </span>
  );
}

export function CommissionTag({ value }: { value: number }) {
  return (
    <span className="block text-right leading-tight" title="Comisión estimada a pagar">
      <span className="block text-sm font-semibold tabular-nums text-text">{formatCordobas(value)}</span>
      <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-wide text-muted/70">
        comisión est.
      </span>
    </span>
  );
}
