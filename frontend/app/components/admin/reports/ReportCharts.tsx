// Gráficos del dashboard de reportes (Recharts).
// Colores de ejes/grilla/tooltip vía tokens CSS para que funcionen en ambos temas.
// Nota: `charts.monthly` siempre trae los 12 meses del año seleccionado (el
// filtro de mes no lo recorta); esos gráficos se titulan "— año".
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";
import type { ReportData } from "~/store/api/reportsApi";
import { cn, formatCordobas, formatUsd } from "~/lib/utils";
import { EXCHANGE_RATE } from "~/lib/constants";

// Paleta categórica (matices separados; sin pares verde/verde ni ámbar/ámbar).
const COLORS = ["#10b981", "#38bdf8", "#f59e0b", "#a855f7", "#f43f5e", "#64748b"];
const SERIES = { ventas: "#10b981", inversion: "#38bdf8", ganancia: "#10b981", comisiones: "#f59e0b" };

const axis = { stroke: "var(--color-muted)", fontSize: 12, tickLine: false, axisLine: false } as const;
const gridStroke = "color-mix(in srgb, var(--color-text) 6%, transparent)";
const barCursor = { fill: "color-mix(in srgb, var(--color-text) 5%, transparent)" };
const lineCursor = { stroke: "var(--color-muted)", strokeDasharray: "4 4", strokeOpacity: 0.4 };
const legendStyle = { fontSize: 12 } as const;

// Ticks compactos para montos en córdobas (C$150k, C$1.2M).
function compactC(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `C$${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `C$${Math.round(v / 1_000)}k`;
  return `C$${v}`;
}

// Tooltip que muestra cada valor en C$ y su equivalente en USD (tasa fija).
// En el donut añade el % del total.
function MoneyTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl border border-border bg-surface px-3 py-2 text-xs text-text shadow-lg"
      style={{ boxShadow: "0 8px 24px rgb(0 0 0 / 0.25)" }}
    >
      {label != null && <div className="mb-1 font-semibold">{label}</div>}
      {payload.map((p, i) => {
        const value = typeof p.value === "number" ? p.value : 0;
        const pct = typeof p.payload?.percent === "number" ? p.payload.percent : undefined;
        return (
          <div key={i} style={{ color: p.color || p.payload?.fill || "var(--color-text)" }}>
            {p.name}: <strong>{formatCordobas(value)}</strong> · {formatUsd(value / EXCHANGE_RATE)}
            {pct != null && <span style={{ color: "var(--color-muted)" }}> ({Math.round(pct * 100)}%)</span>}
          </div>
        );
      })}
    </div>
  );
}

// Gradiente vertical para barras (sólido arriba, se desvanece hacia la base).
function BarGradient({ id, color }: { id: string; color: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={0.95} />
      <stop offset="100%" stopColor={color} stopOpacity={0.35} />
    </linearGradient>
  );
}

export function ReportCharts({ charts }: { charts: ReportData["charts"] }) {
  const monthlyEmpty = !charts.monthly.some((m) => m.inversion || m.ventas);
  const costosTotal = charts.costosFijos.reduce((s, c) => s + c.value, 0);
  const sellersHeight = Math.max(260, charts.performance.length * 52);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Inversión vs. Ventas (C$) — año" empty={monthlyEmpty} className="lg:col-span-2">
        <ResponsiveContainer width="100%" height={300} debounce={50}>
          <BarChart data={charts.monthly} barGap={4} accessibilityLayer>
            <defs>
              <BarGradient id="rc-inv" color={SERIES.inversion} />
              <BarGradient id="rc-ven" color={SERIES.ventas} />
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="month" {...axis} />
            <YAxis {...axis} tickFormatter={compactC} width={56} />
            <Tooltip content={<MoneyTooltip />} cursor={barCursor} />
            <Legend iconType="circle" wrapperStyle={legendStyle} />
            <Bar dataKey="inversion" name="Inversión" fill="url(#rc-inv)" radius={[6, 6, 0, 0]} maxBarSize={28} animationDuration={700} animationEasing="ease-out" />
            <Bar dataKey="ventas" name="Ventas" fill="url(#rc-ven)" radius={[6, 6, 0, 0]} maxBarSize={28} animationDuration={700} animationEasing="ease-out" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Ventas vs. Ganancia (C$) — año" empty={monthlyEmpty}>
        <ResponsiveContainer width="100%" height={260} debounce={50}>
          <AreaChart data={charts.monthly} accessibilityLayer>
            <defs>
              <linearGradient id="rc-fill-ven" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES.inversion} stopOpacity={0.28} />
                <stop offset="100%" stopColor={SERIES.inversion} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="rc-fill-gan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES.ganancia} stopOpacity={0.28} />
                <stop offset="100%" stopColor={SERIES.ganancia} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="month" {...axis} />
            <YAxis {...axis} tickFormatter={compactC} width={56} />
            <Tooltip content={<MoneyTooltip />} cursor={lineCursor} />
            <Legend iconType="circle" wrapperStyle={legendStyle} />
            <Area type="monotone" dataKey="ventas" name="Ventas" stroke={SERIES.inversion} strokeWidth={2.5} fill="url(#rc-fill-ven)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--color-surface)" }} />
            <Area type="monotone" dataKey="ganancia" name="Ganancia tienda" stroke={SERIES.ganancia} strokeWidth={2.5} fill="url(#rc-fill-gan)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--color-surface)" }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Distribución de costos fijos" empty={costosTotal === 0}>
        <ResponsiveContainer width="100%" height={260} debounce={50}>
          <PieChart>
            <Pie
              data={charts.costosFijos} dataKey="value" nameKey="name" cx="50%" cy="50%"
              innerRadius={62} outerRadius={90} paddingAngle={3} cornerRadius={4} stroke="none"
            >
              {charts.costosFijos.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <text x="50%" y="47%" textAnchor="middle" fill="var(--color-muted)" fontSize={11}>
              Total
            </text>
            <text x="50%" y="56%" textAnchor="middle" fill="var(--color-text)" fontSize={16} fontWeight={700}>
              {formatCordobas(costosTotal)}
            </text>
            <Tooltip content={<MoneyTooltip />} />
            <Legend iconType="circle" wrapperStyle={legendStyle} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Vendedores: vendido y comisión (C$)" empty={!charts.performance.length}>
        <ResponsiveContainer width="100%" height={sellersHeight} debounce={50}>
          <BarChart data={charts.performance} layout="vertical" margin={{ left: 20 }} barGap={2} accessibilityLayer>
            <defs>
              <linearGradient id="rc-sell-ven" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={SERIES.ventas} stopOpacity={0.45} />
                <stop offset="100%" stopColor={SERIES.ventas} stopOpacity={0.95} />
              </linearGradient>
              <linearGradient id="rc-sell-com" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={SERIES.comisiones} stopOpacity={0.45} />
                <stop offset="100%" stopColor={SERIES.comisiones} stopOpacity={0.95} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
            <XAxis type="number" {...axis} tickFormatter={compactC} />
            <YAxis type="category" dataKey="sellerName" width={90} {...axis} />
            <Tooltip content={<MoneyTooltip />} cursor={barCursor} />
            <Legend iconType="circle" wrapperStyle={legendStyle} />
            <Bar dataKey="totalVendido" name="Vendido" fill="url(#rc-sell-ven)" radius={[0, 6, 6, 0]} maxBarSize={18} animationDuration={700} animationEasing="ease-out" />
            <Bar dataKey="comisiones" name="Comisión" fill="url(#rc-sell-com)" radius={[0, 6, 6, 0]} maxBarSize={18} animationDuration={700} animationEasing="ease-out" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Ganancia neta vs. Comisiones (C$) — año" empty={monthlyEmpty} className="lg:col-span-2">
        <ResponsiveContainer width="100%" height={260} debounce={50}>
          <BarChart data={charts.monthly} barGap={4} accessibilityLayer>
            <defs>
              <BarGradient id="rc-neta" color={SERIES.ganancia} />
              <BarGradient id="rc-com" color={SERIES.comisiones} />
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="month" {...axis} />
            <YAxis {...axis} tickFormatter={compactC} width={56} />
            <Tooltip content={<MoneyTooltip />} cursor={barCursor} />
            <Legend iconType="circle" wrapperStyle={legendStyle} />
            <Bar dataKey="gananciaNeta" name="Ganancia neta" fill="url(#rc-neta)" radius={[6, 6, 0, 0]} maxBarSize={28} animationDuration={700} animationEasing="ease-out" />
            <Bar dataKey="comisiones" name="Comisiones" fill="url(#rc-com)" radius={[6, 6, 0, 0]} maxBarSize={28} animationDuration={700} animationEasing="ease-out" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  empty = false,
  className,
  children,
}: {
  title: string;
  empty?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("break-inside-avoid rounded-card border border-border bg-surface p-4", className)}>
      <h3 className="mb-3 font-semibold">{title}</h3>
      {empty ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-muted">
          Sin datos en este período
        </div>
      ) : (
        children
      )}
    </div>
  );
}
