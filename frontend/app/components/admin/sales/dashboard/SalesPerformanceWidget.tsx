// Gráfico de rendimiento. Admin: barras de ventas + línea de ganancia (eje dual).
// Vendedor: barras de comisiones con gradiente.
//
// Datos: useSalesTimeseries → GET /sales/timeseries (agregado por mes/día, real).
// Recharts en Remix: ResponsiveContainer mide el DOM, así que renderizamos el chart
// solo tras montar en cliente (guard `mounted`) para evitar warnings de width:0 e
// inconsistencias de hidratación. Mientras tanto: skeleton con la forma del chart.
import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { useSalesDashboard, useSalesTimeseries } from "./useSalesDashboard";
import { WidgetShell } from "./WidgetShell";
import { formatCordobas } from "~/lib/utils";

function ChartSkeleton() {
  return (
    <div className="flex h-64 items-end gap-2">
      {Array.from({ length: 14 }).map((_, i) => (
        <div
          key={i}
          className="skeleton flex-1 rounded-t-md"
          style={{ height: `${30 + ((i * 37) % 60)}%` }}
        />
      ))}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-4 py-3 text-xs shadow-xl border border-white/5">
      <p className="mb-2 font-semibold text-text">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <p key={entry.name} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 capitalize text-muted">
              <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: entry.color }} />
              {entry.name}
            </span>
            <span className="nums font-semibold text-text">{formatCordobas(Number(entry.value))}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

// Leyenda personalizada alineada al estilo de la UI.
function ChartLegend({ payload }: any) {
  if (!payload?.length) return null;
  return (
    <div className="flex items-center justify-center gap-6 pt-2">
      {payload.map((entry: any) => (
        <span key={entry.value} className="flex items-center gap-1.5 text-xs text-muted">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[3px]"
            style={{ background: entry.color }}
          />
          <span className="capitalize">{entry.value}</span>
        </span>
      ))}
    </div>
  );
}

const fmtAxis = (v: number) => {
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return `${v}`;
};

export function SalesPerformanceWidget() {
  const { filters, isAdmin } = useSalesDashboard();
  const { data, isLoading, granularity } = useSalesTimeseries(filters);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Etiqueta legible desde la fecha ISO del backend (locale en cliente).
  // Por mes (vista anual) → "ene 26"; por día (mes/día concreto) → "01 ene".
  const chartData = useMemo(
    () =>
      data.map((p) => ({
        ...p,
        label: new Date(`${p.date}T00:00:00`).toLocaleDateString(
          "es-NI",
          granularity === "month"
            ? { month: "short", year: "2-digit" }
            : { day: "2-digit", month: "short" },
        ),
      })),
    [data, granularity],
  );

  // Ambos ven barras (ventas) + línea (ganancia/comisión); solo cambian títulos y series.
  const title = isAdmin ? "Rendimiento de ventas" : "Mis ventas y comisiones";
  const emptyMsg = "Sin ventas aprobadas en este período.";

  // Colores del tema — la comisión del vendedor usa violeta para
  // que contraste con las barras verdes de ventas.
  const COL_VENTAS = "var(--color-accent)";
  const COL_GANANCIA = "#a78bfa"; // purple-400 — contraste claro sobre barras verdes
  const COL_COMISION = "#c084fc"; // purple-300 — contrasta con barras verdes (antes era whatsapp green)

  return (
    <WidgetShell title={title} icon={TrendingUp} tone="emerald">
      {!mounted || (isLoading && chartData.length === 0) ? (
        <ChartSkeleton />
      ) : chartData.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center text-center">
          <p className="text-sm text-muted">{emptyMsg}</p>
        </div>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 12, right: 12, left: 4, bottom: 4 }}>
              <defs>
                {/* Gradiente vertical para las barras de ventas — 3 stops para profundidad */}
                <linearGradient id="gradBarVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                  <stop offset="50%" stopColor={COL_VENTAS} stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#047857" stopOpacity={0.6} />
                </linearGradient>
                {/* Gradiente para barras de comisión (vista vendedor) */}
                <linearGradient id="gradBarComision" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COL_COMISION} stopOpacity={0.85} />
                  <stop offset="100%" stopColor={COL_COMISION} stopOpacity={0.45} />
                </linearGradient>
                {/* Área bajo la línea de comisión (vendedor) */}
                <linearGradient id="gradAreaComision" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COL_COMISION} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={COL_COMISION} stopOpacity={0.02} />
                </linearGradient>
                {/* Área bajo la línea de ganancia (admin) */}
                <linearGradient id="gradAreaGanancia" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COL_GANANCIA} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={COL_GANANCIA} stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />

              <XAxis
                dataKey="label"
                tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
                tickMargin={10}
                padding={{ left: 8, right: 8 }}
              />

              {/* Eje izquierdo: ventas (barras) */}
              <YAxis
                yAxisId="left"
                tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={48}
                allowDecimals={false}
                domain={[0, (dataMax: number) => Math.ceil((dataMax * 1.15) / 1000) * 1000]}
                tickFormatter={fmtAxis}
              />

              {/* Eje derecho: ganancia (admin) — solo visible para admin con línea */}
              {isAdmin && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: COL_GANANCIA, fontSize: 11, fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                width={48}
                allowDecimals={false}
                domain={[0, (dataMax: number) => Math.ceil((dataMax * 1.25) / 1000) * 1000]}
                tickFormatter={fmtAxis}
              />
              )}

              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: "var(--color-border)", opacity: 0.15 }}
              />

              <Legend content={<ChartLegend />} />

              {isAdmin ? (
                <>
                  {/* Barras de ventas: eje izquierdo */}
                  <Bar
                    yAxisId="left"
                    dataKey="ventas"
                    name="Ventas"
                    fill="url(#gradBarVentas)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                    animationDuration={600}
                  />
                  {/* Línea de ganancia: eje derecho — linear para que los puntos caigan exacto en cada barra */}
                  <Line
                    yAxisId="right"
                    type="linear"
                    dataKey="ganancia"
                    name="Ganancia"
                    stroke={COL_GANANCIA}
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: COL_GANANCIA, strokeWidth: 2.5, stroke: "var(--color-surface)" }}
                    activeDot={{ r: 7, strokeWidth: 2.5, stroke: "var(--color-surface)" }}
                    animationDuration={900}
                  />
                </>
              ) : (
                /* Vendedor: barras agrupadas de ventas + comisión (mismo eje, sin confusión) */
                <>
                  <Bar
                    yAxisId="left"
                    dataKey="ventas"
                    name="Ventas"
                    fill="url(#gradBarVentas)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    animationDuration={600}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="comision"
                    name="Comisión"
                    fill="url(#gradBarComision)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    animationDuration={800}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </WidgetShell>
  );
}
