import { TrendingUp, PackageX } from "lucide-react";
import { PanelHeader, EmptyRows } from "./shared";
import type { SearchAnalytics } from "~/store/api/searchAnalyticsApi";

export function TopSearchesPanel({ data }: { data: SearchAnalytics }) {
  const rows = data.topSearches;
  return (
    <section className="card-premium rounded-card p-5">
      <PanelHeader icon={<TrendingUp className="h-4 w-4" />} title="Top búsquedas" subtitle="Los términos más tecleados por tus clientes" />
      {rows.length === 0 ? (
        <EmptyRows text="Aún no hay búsquedas registradas en este rango." />
      ) : (
        <ol className="mt-4 space-y-1">
          {rows.map((r, i) => (
            <li key={r.query} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-hover">
              <span className="w-5 shrink-0 text-right text-sm font-bold tabular-nums text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-medium text-text">{r.query}</span>
              <span className="shrink-0 text-xs text-muted">
                {r.results} {r.results === 1 ? "resultado" : "resultados"}
              </span>
              <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-accent/12 px-1.5 text-xs font-bold tabular-nums text-accent-2">
                {r.count}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ZeroResultsPanel({ data }: { data: SearchAnalytics }) {
  const rows = data.zeroResultSearches;
  return (
    <section className="card-premium rounded-card p-5">
      <PanelHeader icon={<PackageX className="h-4 w-4" />} title="Búsquedas fallidas" subtitle="Demanda sin resultados — tu lista de inventario ideal" tone="warning" />
      {rows.length === 0 ? (
        <EmptyRows text="Ninguna búsqueda quedó sin resultados. ¡Buena cobertura de catálogo!" />
      ) : (
        <ol className="mt-4 space-y-1">
          {rows.map((r) => (
            <li key={r.query} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-hover">
              <span className="min-w-0 flex-1 truncate font-medium text-text">{r.query}</span>
              <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-warning/15 px-1.5 text-xs font-bold tabular-nums text-warning">
                {r.count}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
