// Analíticas del storefront (Centro de Administración). Lee los agregados de la
// colección analytics_events (búsquedas + pageviews) y los muestra con gráficos
// (recharts) + listas: Visitas vs Búsquedas, Top búsquedas, Búsquedas fallidas y
// Tráfico por artículo.
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, PackageX, Search, Eye, Hash, Ban, BarChart3, X, Smartphone, Monitor, MousePointerClick, Bot } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { RequireRole } from "~/components/admin/RequireRole";
import { Skeleton } from "~/components/ui/Skeleton";
import { cn } from "~/lib/utils";
import { useGetCatalogQuery } from "~/store/api/catalogApi";
import { useGetSearchAnalyticsQuery, useGetSearchSessionsQuery, useGetRawSearchesQuery, type SearchAnalytics } from "~/store/api/searchAnalyticsApi";

const RANGES = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
];

const COL_VISITS = "var(--color-badge)"; // violeta — tráfico
const COL_SEARCHES = "var(--color-accent)"; // verde — búsquedas

export default function AdminBusquedas() {
  const [days, setDays] = useState(30);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(false);
  const { data, isLoading, isFetching } = useGetSearchAnalyticsQuery({ days });
  const { data: products = [] } = useGetCatalogQuery();

  // recharts + Remix: renderizar el chart solo tras montar en cliente (evita el
  // warning de width:0 y desajustes de hidratación).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const nameById = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products]);

  return (
    <RequireRole allowed={["admin"]}>
      <div className="space-y-6">
        {/* Encabezado + selector de rango */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text">Analíticas del Storefront</h1>
            <p className="text-muted">
              Tráfico real y comportamiento de búsqueda de tus clientes.
            </p>
          </div>
          <div className="flex gap-1 rounded-pill border border-border bg-surface p-1">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                onClick={() => setDays(r.days)}
                className={cn(
                  "rounded-pill px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  days === r.days ? "bg-accent text-bg" : "text-muted hover:text-text",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading || !data ? (
          <LoadingState />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            aria-busy={isFetching}
            className={cn("space-y-6 transition-opacity duration-200", isFetching && "pointer-events-none opacity-50")}
          >
            <Totals data={data} onOpenSessions={() => setDrawerOpen(true)} onOpenSearches={() => setSearchDrawerOpen(true)} />
            <TrafficVsSearchChart data={data} mounted={mounted} />
            <div className="grid gap-4 lg:grid-cols-2">
              <TopSearchesPanel data={data} />
              <ZeroResultsPanel data={data} />
            </div>
            <TrafficByProductChart data={data} nameById={nameById} mounted={mounted} />
            {data.totals.capped && (
              <p className="text-center text-xs text-muted">
                Mostrando una muestra de los eventos más recientes (hay más datos en el rango).
              </p>
            )}
          </motion.div>
        )}
        <SessionsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} days={days} />
        <SearchesLogDrawer open={searchDrawerOpen} onClose={() => setSearchDrawerOpen(false)} days={days} />
      </div>
    </RequireRole>
  );
}

// ── Totales ───────────────────────────────────────────────────────────────
function Totals({ data, onOpenSessions, onOpenSearches }: { data: SearchAnalytics; onOpenSessions?: () => void; onOpenSearches?: () => void; }) {
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

// ── Gráfico de líneas: Visitas vs Búsquedas ─────────────────────────────────
function TrafficVsSearchChart({ data, mounted }: { data: SearchAnalytics; mounted: boolean }) {
  const chartData = useMemo(
    () =>
      data.timeseries.map((p) => ({
        ...p,
        label: new Date(`${p.day}T00:00:00`).toLocaleDateString("es-NI", { day: "2-digit", month: "short" }),
      })),
    [data.timeseries],
  );

  const hasData = data.totals.pageviews + data.totals.searches > 0;

  return (
    <section className="card-premium rounded-card p-5">
      <PanelHeader icon={<TrendingUp className="h-4 w-4" />} title="Visitas vs Búsquedas" subtitle="Tráfico diario y cuánto se usa el buscador" />
      {!mounted ? (
        <Skeleton className="mt-4 h-64 rounded-xl" />
      ) : !hasData ? (
        <EmptyRows text="Aún no hay tráfico registrado en este rango." />
      ) : (
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={28}
                tickMargin={10}
              />
              <YAxis
                tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={36}
                allowDecimals={false}
              />
              <Tooltip content={<CountTooltip />} cursor={{ stroke: "var(--color-border)" }} />
              <Line type="monotone" dataKey="visits" name="Visitas" stroke={COL_VISITS} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="searches" name="Búsquedas" stroke={COL_SEARCHES} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      <Legend2 items={[{ name: "Visitas", color: COL_VISITS }, { name: "Búsquedas", color: COL_SEARCHES }]} />
    </section>
  );
}

// ── Gráfico de barras: Tráfico por artículo ─────────────────────────────────
function TrafficByProductChart({
  data,
  nameById,
  mounted,
}: {
  data: SearchAnalytics;
  nameById: Map<string, string>;
  mounted: boolean;
}) {
  const chartData = useMemo(
    () =>
      data.trafficByProduct.slice(0, 8).map((t) => {
        const name = nameById.get(t.productId) || t.productId;
        return { name, short: name.length > 22 ? `${name.slice(0, 22)}…` : name, views: t.views };
      }),
    [data.trafficByProduct, nameById],
  );

  return (
    <section className="card-premium rounded-card p-5">
      <PanelHeader icon={<BarChart3 className="h-4 w-4" />} title="Tráfico por artículo" subtitle="Las fichas de producto más visitadas (tus estrella orgánicos)" />
      {!mounted ? (
        <Skeleton className="mt-4 h-64 rounded-xl" />
      ) : chartData.length === 0 ? (
        <EmptyRows text="Aún no hay visitas a fichas de producto en este rango." />
      ) : (
        <div className="mt-4 w-full" style={{ height: Math.max(200, chartData.length * 44) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "var(--color-muted)", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="short"
                tick={{ fill: "var(--color-muted)", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={150}
              />
              <Tooltip content={<CountTooltip />} cursor={{ fill: "var(--color-border)", opacity: 0.15 }} />
              <Bar dataKey="views" name="Visitas" fill={COL_VISITS} radius={[0, 4, 4, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

// ── Listas ──────────────────────────────────────────────────────────────────
function TopSearchesPanel({ data }: { data: SearchAnalytics }) {
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

function ZeroResultsPanel({ data }: { data: SearchAnalytics }) {
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

// ── Piezas compartidas ────────────────────────────────────────────────────
function CountTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-premium">
      {label && <p className="mb-1 font-semibold text-text">{label}</p>}
      <div className="space-y-1">
        {payload.map((entry) => (
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

function Legend2({ items }: { items: { name: string; color: string }[] }) {
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

function PanelHeader({
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

function EmptyRows({ text }: { text: string }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-3 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/8 text-accent-2 ring-1 ring-inset ring-accent/15" aria-hidden>
        <Search className="h-5 w-5" />
      </span>
      <p className="max-w-xs text-balance text-sm text-muted">{text}</p>
    </div>
  );
}

function LoadingState() {
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

// ── Sessions Drawer ───────────────────────────────────────────────────────
function SessionsDrawer({ open, onClose, days }: { open: boolean; onClose: () => void; days: number }) {
  const { data, isLoading } = useGetSearchSessionsQuery({ days }, { skip: !open });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="flex h-full w-full max-w-xl flex-col bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4 bg-surface/50 backdrop-blur-md">
          <div>
            <h2 className="text-xl font-bold text-text">Registro de Sesiones</h2>
            <p className="text-xs text-muted">Secuencia de acciones por usuario</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-surface-2 p-2 text-muted hover:text-text hover:bg-border transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-40 rounded-card" />
              <Skeleton className="h-40 rounded-card" />
            </div>
          ) : !data?.sessions?.length ? (
            <EmptyRows text="No hay sesiones registradas en este rango." />
          ) : (
            data.sessions.map((s) => (
              <div key={s.id} className="card-premium relative overflow-hidden rounded-card border border-border bg-surface shadow-premium">
                {/* Header de la sesión */}
                <div className="border-b border-border/50 bg-surface-2/30 px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-text" title={s.userAgent}>
                          {s.userAgent || "Navegador desconocido"}
                        </p>
                        {s.isNewVisitor !== undefined && (
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider shrink-0",
                            s.isNewVisitor ? "bg-accent/15 text-accent" : "bg-badge/15 text-badge"
                          )}>
                            {s.isNewVisitor ? "NUEVO" : "RECURRENTE"}
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="font-mono bg-border/50 px-1.5 py-0.5 rounded text-[10px] text-muted">
                          ID: {s.id.slice(0, 8)}
                        </span>
                        
                        {s.entryType && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] border border-border/50 text-muted font-medium">
                            {s.entryType === "direct_landing" ? "Tráfico Directo" : "Clic Interno"}
                          </span>
                        )}
                        
                        {s.utmSource && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 font-medium border border-blue-500/20" title={`Campaña: ${s.utmCampaign || 'N/A'}`}>
                            Ads: {s.utmSource} {s.utmMedium && `/ ${s.utmMedium}`}
                          </span>
                        )}
                        
                        {!s.utmSource && s.referrer && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-2 text-muted font-medium border border-border/50 truncate max-w-[150px]" title={s.referrer}>
                            De: {s.referrer.replace(/^https?:\/\//, '').split('/')[0]}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-[11px] text-muted font-light">
                        {new Date(s.startTime).toLocaleDateString("es-NI", { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent">
                      {s.actions.length} acciones
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="p-5">
                  <ul className="relative space-y-6 before:absolute before:inset-y-2 before:left-[15px] before:w-[2px] before:bg-border/60 pl-2">
                    {s.actions.map((act, i) => (
                      <li key={i} className="relative pl-8">
                        <span className={cn(
                          "absolute left-[-5px] top-0.5 grid h-6 w-6 place-items-center rounded-full ring-4 ring-surface",
                          act.type === 'pageview' ? "bg-badge/15 text-badge" : "bg-accent/15 text-accent"
                        )}>
                          {act.type === 'pageview' ? <Eye className="h-3 w-3" /> : <Search className="h-3 w-3" />}
                        </span>
                        
                        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                          <div className="text-sm font-medium text-text">
                            {act.type === 'pageview' ? (
                              <span className="flex items-center gap-2">
                                <span className="text-muted font-normal">Visitó:</span>
                                <span className="text-accent-2 truncate">{act.page}</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <span className="text-muted font-normal">Buscó:</span>
                                <span>"{act.query}"</span>
                                <span className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                  act.resultsCount === 0 ? "bg-warning/15 text-warning" : "bg-accent/10 text-accent"
                                )}>
                                  {act.resultsCount} res
                                </span>
                              </span>
                            )}
                          </div>
                          <span className="shrink-0 text-xs text-muted tabular-nums">
                            {new Date(act.timestamp).toLocaleTimeString("es-NI", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Searches Log Drawer ───────────────────────────────────────────────────────
function SearchesLogDrawer({ open, onClose, days }: { open: boolean; onClose: () => void; days: number }) {
  const { data, isLoading } = useGetRawSearchesQuery({ days }, { skip: !open });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="flex h-full w-full max-w-2xl flex-col bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4 bg-surface/50 backdrop-blur-md">
          <div>
            <h2 className="text-xl font-bold text-text">Historial de Búsquedas</h2>
            <p className="text-xs text-muted">Auditoría en crudo (Defensive Programming)</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-surface-2 p-2 text-muted hover:text-text hover:bg-border transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 rounded-card" />
              <Skeleton className="h-20 rounded-card" />
            </div>
          ) : !data?.searches?.length ? (
            <EmptyRows text="No hay búsquedas registradas en este rango." />
          ) : (
            <div className="space-y-3">
              {data.searches.map((s) => (
                <div key={s.id} className="card-premium flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 shadow-premium transition-colors hover:bg-surface-hover">
                  
                  {/* Info Búsqueda y Fecha */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-base font-bold text-text">
                        "{s.query}"
                      </p>
                      {s.clickedProductId && (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent" title="El usuario hizo clic en un resultado">
                          <MousePointerClick className="h-3 w-3" /> CTR
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                      <span>{new Date(s.timestamp).toLocaleDateString("es-NI", { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      <span>•</span>
                      <span className="font-mono bg-border/50 px-1.5 py-0.5 rounded text-[10px]">{s.ip}</span>
                    </p>
                  </div>

                  {/* Resultados (Badge) */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={cn(
                      "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider",
                      s.resultsCount === 0 ? "bg-warning/15 text-warning" : "bg-badge/15 text-badge"
                    )}>
                      {s.resultsCount} res
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted uppercase tracking-wider">
                      {s.deviceType === 'Mobile' ? <Smartphone className="h-3.5 w-3.5 text-accent-2" /> :
                       s.deviceType === 'Desktop' ? <Monitor className="h-3.5 w-3.5 text-accent-2" /> :
                       <Bot className="h-3.5 w-3.5 text-warning" />}
                      {s.deviceType}
                    </span>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
