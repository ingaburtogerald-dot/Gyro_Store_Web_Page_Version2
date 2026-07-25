import { Search } from "lucide-react";
import { Skeleton } from "~/components/ui/Skeleton";
import { cn } from "~/lib/utils";
import type { TooltipProps } from "recharts";
import type React from "react";

export function CountTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-premium">
      {label && <p className="mb-1 font-semibold text-text">{label}</p>}
      <div className="space-y-1">
        {payload.map((entry: any) => (
          <p key={entry.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted">
              <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: entry.color }} />
              {entry.name}
            </span>
            <span className="font-semibold tabular-nums text-text">{entry.value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

export function Legend2({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div className="flex items-center justify-center gap-6 pt-3">
      {items.map((it) => (
        <span key={it.name} className="flex items-center gap-1.5 text-xs text-muted">
          <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: it.color }} />
          {it.name}
        </span>
      ))}
    </div>
  );
}

export function PanelHeader({
  icon,
  title,
  subtitle,
  tone = "accent",
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  tone?: "accent" | "warning";
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
          tone === "warning" ? "bg-warning/15 text-warning" : "bg-accent/12 text-accent-2",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="font-heading text-lg font-bold tracking-tight text-text">{title}</h2>
        {subtitle && <p className="text-sm font-light text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

export function EmptyRows({ text }: { text: string }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-3 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/8 text-accent-2 ring-1 ring-inset ring-accent/15" aria-hidden>
        <Search className="h-5 w-5" />
      </span>
      <p className="max-w-xs text-balance text-sm text-muted">{text}</p>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-card" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
      </div>
    </div>
  );
}
