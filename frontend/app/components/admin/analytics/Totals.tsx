import { Eye, Hash, Search, Ban } from "lucide-react";
import { cn } from "~/lib/utils";
import type { SearchAnalytics } from "~/store/api/searchAnalyticsApi";

export function Totals({ data, onOpenSessions, onOpenSearches }: { data: SearchAnalytics; onOpenSessions?: () => void; onOpenSearches?: () => void; }) {
  const items = [
    { icon: Eye, label: "Visitas", value: data.totals.pageviews, tone: "violet" as const, onClick: onOpenSessions },
    { icon: Hash, label: "Búsquedas", value: data.totals.searches, tone: "accent" as const, onClick: onOpenSearches },
    { icon: Search, label: "Términos únicos", value: data.totals.uniqueTerms, tone: "accent" as const },
    { icon: Ban, label: "Sin resultados", value: data.totals.zeroResultTerms, tone: "warning" as const },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((it) => (
        <div 
          key={it.label} 
          onClick={it.onClick}
          className={cn(
            "card-premium flex items-center gap-3 rounded-card p-4 transition-colors",
            it.onClick ? "cursor-pointer hover:border-accent/40 hover:bg-surface-hover" : ""
          )}
        >
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
              it.tone === "warning"
                ? "bg-warning/15 text-warning"
                : it.tone === "violet"
                  ? "bg-badge/15 text-badge"
                  : "bg-accent/12 text-accent-2",
            )}
            aria-hidden
          >
            <it.icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-2xl font-bold tabular-nums text-text">{it.value}</p>
            <p className="truncate text-sm text-muted">{it.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
