// Analíticas del storefront (Centro de Administración). Lee los agregados de la
// colección analytics_events (búsquedas + pageviews) y los muestra con gráficos
// (recharts) + listas: Visitas vs Búsquedas, Top búsquedas, Búsquedas fallidas y
// Tráfico por artículo.
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, PackageX, Search, Eye, Hash, Ban, BarChart3 } from "lucide-react";
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
import { useGetSearchAnalyticsQuery, type SearchAnalytics } from "~/store/api/searchAnalyticsApi";

const RANGES = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
];

const COL_VISITS = "var(--color-badge)"; // violeta — tráfico
const COL_SEARCHES = "var(--color-accent)"; // verde — búsquedas

export default function AdminBusquedas() {
  const [days, setDays] = useState(30);
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
            <Totals data={data} />
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
      </div>
    </RequireRole>
  );
}

// ── Totales ───────────────────────────────────────────────────────────────
function Totals({ data }: { data: SearchAnalytics }) {
  const items = [
    { icon: Eye, label: "Visitas", value: data.totals.pageviews, tone: "violet" as const },
    { icon: Hash, label: "Búsquedas", value: data.totals.searches, tone: "accent" as const },
    { icon: Search, label: "Términos únicos", value: data.totals.uniqueTerms, tone: "accent" as const },
    { icon: Ban, label: "Sin resultados", value: data.totals.zeroResultTerms, tone: "warning" as const },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="card-premium flex items-center gap-3 rounded-card p-4">
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
