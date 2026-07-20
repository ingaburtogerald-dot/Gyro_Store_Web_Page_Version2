// Analíticas del storefront (Centro de Administración). Lee los agregados de la
// colección analytics_events (búsquedas + pageviews) y los muestra con gráficos
// (recharts) + listas: Visitas vs Búsquedas, Top búsquedas, Búsquedas fallidas y
// Tráfico por artículo.
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  PackageX,
  Search,
  Eye,
  Hash,
  Ban,
  BarChart3,
  X,
  Smartphone,
  Monitor,
  MousePointerClick,
  Bot,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock,
  Laptop,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Globe
} from "lucide-react";
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
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
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

// ── Helpers de Formateo para Marketing ──

interface UAInfo {
  os: string;
  browser: string;
  device: "Desktop" | "Mobile" | "Bot" | "Desconocido";
}

function cleanUserAgent(ua: string): UAInfo {
  if (!ua) return { os: "Desconocido", browser: "Desconocido", device: "Desconocido" };
  const lowercaseUA = ua.toLowerCase();
  
  let os = "Desconocido";
  if (lowercaseUA.includes("windows")) os = "Windows";
  else if (lowercaseUA.includes("iphone")) os = "iOS (iPhone)";
  else if (lowercaseUA.includes("ipad")) os = "iOS (iPad)";
  else if (lowercaseUA.includes("android")) os = "Android";
  else if (lowercaseUA.includes("macintosh") || lowercaseUA.includes("mac os")) os = "macOS";
  else if (lowercaseUA.includes("linux")) os = "Linux";
  
  let browser = "Desconocido";
  if (lowercaseUA.includes("chrome") || lowercaseUA.includes("chromium")) browser = "Chrome";
  else if (lowercaseUA.includes("safari") && !lowercaseUA.includes("chrome")) browser = "Safari";
  else if (lowercaseUA.includes("firefox")) browser = "Firefox";
  else if (lowercaseUA.includes("edge")) browser = "Edge";
  else if (lowercaseUA.includes("opera") || lowercaseUA.includes("opr")) browser = "Opera";
  else if (lowercaseUA.includes("bot") || lowercaseUA.includes("crawl") || lowercaseUA.includes("spider")) browser = "Bot/Crawler";
  
  let device: "Desktop" | "Mobile" | "Bot" | "Desconocido" = "Desconocido";
  if (lowercaseUA.includes("bot") || lowercaseUA.includes("crawl") || lowercaseUA.includes("spider")) {
    device = "Bot";
  } else if (/mobile|android|iphone|ipad|ipod|windows phone/i.test(lowercaseUA)) {
    device = "Mobile";
  } else if (/macintosh|windows|linux/i.test(lowercaseUA)) {
    device = "Desktop";
  }
  
  return { os, browser, device };
}

function cleanProductUrl(url: string): string {
  if (!url) return "";
  
  // Si es una URL de producto (/producto/nombre-articulo--id)
  if (url.startsWith("/producto/")) {
    const raw = url.slice("/producto/".length).split(/[?#]/)[0];
    const withoutId = raw.split("--")[0];
    const name = withoutId.replace(/[-_]/g, " ");
    return name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  
  // Si es una URL de combo (/combo/nombre-combo--id)
  if (url.startsWith("/combo/")) {
    const raw = url.slice("/combo/".length).split(/[?#]/)[0];
    const withoutId = raw.split("--")[0];
    const name = withoutId.replace(/[-_]/g, " ");
    return "Combo: " + name
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  // Rutas estáticas de la tienda
  if (url === "/") return "Página de Inicio";
  if (url === "/combos") return "Catálogo de Combos";
  if (url === "/contacto") return "Formulario de Contacto";
  
  return url;
}

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
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  const toggleSession = (id: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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
            <p className="text-xs text-muted">Secuencia de acciones por usuario (Acordeón de Marketing)</p>
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
              <Skeleton className="h-20 rounded-card" />
            </div>
          ) : !data?.sessions?.length ? (
            <EmptyRows text="No hay sesiones registradas en este rango." />
          ) : (
            data.sessions.map((s) => {
              const isExpanded = expandedSessions.has(s.id);
              const uaInfo = cleanUserAgent(s.userAgent);
              
              let DeviceIcon = Monitor;
              if (uaInfo.device === "Mobile") DeviceIcon = Smartphone;
              else if (uaInfo.device === "Bot") DeviceIcon = Bot;
              else if (uaInfo.device === "Desconocido") DeviceIcon = Globe;

              return (
                <div
                  key={s.id}
                  className="card-premium overflow-hidden rounded-card border border-border bg-surface shadow-premium transition-all duration-200"
                >
                  {/* Fila compacta de la sesión (Trigger del acordeón) */}
                  <button
                    onClick={() => toggleSession(s.id)}
                    className="w-full text-left flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-hover transition-colors focus-visible:outline-none"
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-3">
                      {/* Icono del Dispositivo */}
                      <span className={cn(
                        "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                        uaInfo.device === "Bot" ? "bg-warning/10 text-warning" : "bg-accent/10 text-accent-2"
                      )}>
                        <DeviceIcon className="h-5 w-5" />
                      </span>
                      
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-sm text-text truncate">
                            {uaInfo.os}
                          </p>
                          <span className="text-[10px] text-muted font-normal">• {uaInfo.browser}</span>
                          
                          {s.isNewVisitor !== undefined && (
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider shrink-0",
                              s.isNewVisitor ? "bg-accent/15 text-accent" : "bg-badge/15 text-badge"
                            )}>
                              {s.isNewVisitor ? "NUEVO" : "RECURRENTE"}
                            </span>
                          )}
                        </div>
                        
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="font-mono bg-border/50 px-1.5 py-0.5 rounded text-[9px] text-muted">
                            ID: {s.id.slice(0, 8)}
                          </span>
                          
                          {s.utmSource && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-500/10 text-blue-400 font-medium border border-blue-500/20" title={`Campaña: ${s.utmCampaign || 'N/A'}`}>
                              Ads: {s.utmSource}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Hora de inicio y conteo de acciones */}
                      <div className="text-right">
                        <span className="block text-xs font-bold text-text tabular-nums">
                          {new Date(s.startTime).toLocaleTimeString("es-NI", { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="block text-[10px] text-muted">
                          {s.actions.length} {s.actions.length === 1 ? "acción" : "acciones"}
                        </span>
                      </div>
                      
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted shrink-0" />
                      )}
                    </div>
                  </button>

                  {/* Cuerpo expandible con Timeline */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border/50 bg-surface-2/15 p-5">
                          {/* Detalle extendido de la sesión (Referrer/Origen) */}
                          <div className="mb-4 text-xs space-y-1 text-muted border-b border-border/30 pb-3">
                            {s.entryType && (
                              <p>
                                <span className="font-semibold text-text">Entrada:</span>{" "}
                                {s.entryType === "direct_landing" ? "Tráfico Directo" : "Clic Interno"}
                              </p>
                            )}
                            {s.referrer && (
                              <p className="truncate" title={s.referrer}>
                                <span className="font-semibold text-text">Referente:</span>{" "}
                                {s.referrer}
                              </p>
                            )}
                            {s.userAgent && (
                              <p className="text-[10px] italic break-all" title={s.userAgent}>
                                <span className="font-semibold text-text not-italic">UA:</span> {s.userAgent}
                              </p>
                            )}
                          </div>

                          {/* Timeline de acciones */}
                          <ul className="relative space-y-6 before:absolute before:inset-y-2 before:left-[15px] before:w-[2px] before:bg-border/60 pl-2">
                            {s.actions.map((act, i) => (
                              <li key={i} className="relative pl-8 flex items-start gap-3">
                                {/* Icono del nodo en Timeline */}
                                <span className={cn(
                                  "absolute left-[-5px] top-0.5 grid h-6 w-6 place-items-center rounded-full ring-4 ring-surface",
                                  act.type === 'pageview' ? "bg-badge/15 text-badge" : "bg-accent/15 text-accent"
                                )}>
                                  {act.type === 'pageview' ? <Eye className="h-3 w-3" /> : <Search className="h-3 w-3" />}
                                </span>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                    <div className="text-sm font-medium text-text flex items-center flex-wrap gap-2 min-w-0">
                                      {act.type === 'pageview' ? (
                                        <>
                                          <span className="text-muted font-normal">Visitó:</span>
                                          
                                          {/* TODO: Inyectar la imagen real del producto aquí usando act.page o el productId */}
                                          {act.page?.startsWith("/producto") && (
                                            <div className="h-6 w-6 rounded bg-border/40 shrink-0 flex items-center justify-center text-[8px] text-muted font-bold" title="Miniatura del producto">
                                              IMG
                                            </div>
                                          )}
                                          
                                          <span className="text-accent-2 truncate font-semibold" title={act.page}>
                                            {cleanProductUrl(act.page || "")}
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="text-muted font-normal">Buscó:</span>
                                          <span className="font-semibold">"{act.query}"</span>
                                          <span className={cn(
                                            "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0",
                                            act.resultsCount === 0 ? "bg-warning/15 text-warning" : "bg-accent/10 text-accent"
                                          )}>
                                            {act.resultsCount} res
                                          </span>
                                        </>
                                      )}
                                    </div>
                                    <span className="shrink-0 text-xs text-muted tabular-nums">
                                      {new Date(act.timestamp).toLocaleTimeString("es-NI", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Searches Log Drawer ───────────────────────────────────────────────────────
interface SearchLogItem {
  id: string;
  query: string;
  resultsCount: number;
  clickedProductId: string | null;
  timestamp: string;
  ip: string;
  deviceType: string;
}

function SearchesLogDrawer({ open, onClose, days }: { open: boolean; onClose: () => void; days: number }) {
  const { data, isLoading } = useGetRawSearchesQuery({ days }, { skip: !open });
  const [sorting, setSorting] = useState<SortingState>([]);

  const searchesData = useMemo(() => data?.searches || [], [data?.searches]);

  const columns = useMemo<ColumnDef<SearchLogItem>[]>(
    () => [
      {
        accessorKey: "query",
        header: "Término de Búsqueda",
        cell: (info) => {
          const query = info.getValue() as string;
          const clicked = info.row.original.clickedProductId;
          return (
            <div className="flex items-center gap-2 max-w-[200px] sm:max-w-none">
              <span className="font-semibold text-text truncate block">
                "{query}"
              </span>
              {clicked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold text-accent shrink-0" title="Clic en producto (CTR)">
                  <MousePointerClick className="h-3 w-3" /> CTR
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "resultsCount",
        header: "Resultados",
        cell: (info) => {
          const count = info.getValue() as number;
          const isZero = count === 0;
          return (
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider",
              isZero ? "bg-danger/15 text-danger border border-danger/20 animate-pulse" : "bg-badge/15 text-badge"
            )}>
              {count} res
            </span>
          );
        },
      },
      {
        accessorKey: "clickedProductId",
        header: "Clics (CTR)",
        cell: (info) => {
          const clicked = Boolean(info.getValue());
          return (
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              clicked ? "bg-accent/15 text-accent border border-accent/20" : "bg-surface-2 border border-border/50 text-muted"
            )}>
              {clicked ? "Sí" : "No"}
            </span>
          );
        },
      },
      {
        accessorKey: "timestamp",
        header: "Fecha/Hora",
        cell: (info) => {
          const val = info.getValue() as string;
          return (
            <div className="flex flex-col text-[11px] text-muted">
              <span className="font-semibold text-text/80">
                {new Date(val).toLocaleDateString("es-NI", { month: "short", day: "numeric" })}
              </span>
              <span className="text-[10px]">
                {new Date(val).toLocaleTimeString("es-NI", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "deviceType",
        header: "Dispositivo",
        cell: (info) => {
          const dev = info.getValue() as string;
          return (
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted uppercase tracking-wider">
              {dev === 'Mobile' ? <Smartphone className="h-3.5 w-3.5 text-accent-2" /> :
               dev === 'Desktop' ? <Monitor className="h-3.5 w-3.5 text-accent-2" /> :
               <Bot className="h-3.5 w-3.5 text-warning" />}
              <span className="hidden sm:inline">{dev}</span>
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: searchesData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="flex h-full w-full max-w-4xl flex-col bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4 bg-surface/50 backdrop-blur-md">
          <div>
            <h2 className="text-xl font-bold text-text">Historial de Búsquedas</h2>
            <p className="text-xs text-muted">Auditoría en tabla interactiva para marketing y CTR</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-surface-2 p-2 text-muted hover:text-text hover:bg-border transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          ) : searchesData.length === 0 ? (
            <EmptyRows text="No hay búsquedas registradas en este rango." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-premium">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b border-border/80 bg-surface-2/40">
                      {headerGroup.headers.map((header) => {
                        const isSorted = header.column.getIsSorted();
                        return (
                          <th
                            key={header.id}
                            className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider text-muted select-none cursor-pointer hover:text-text hover:bg-surface-2 transition-colors"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <div className="flex items-center gap-1.5">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {header.column.getCanSort() && (
                                isSorted === "asc" ? (
                                  <ArrowUp className="h-3.5 w-3.5 text-accent shrink-0" />
                                ) : isSorted === "desc" ? (
                                  <ArrowDown className="h-3.5 w-3.5 text-accent shrink-0" />
                                ) : (
                                  <ArrowUpDown className="h-3.5 w-3.5 opacity-30 hover:opacity-100 shrink-0" />
                                )
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row, idx) => {
                    const isZero = row.original.resultsCount === 0;
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          "border-b border-border/40 hover:bg-surface-hover/70 transition-colors",
                          idx % 2 === 1 ? "bg-surface-2/20" : "",
                          isZero ? "bg-danger/5 hover:bg-danger/10 border-l-2 border-l-danger" : ""
                        )}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3.5 align-middle">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
