// Gráfico de rendimiento. Admin: ventas vs ganancia. Vendedor: sus comisiones.
// Curva suave (type="natural") para un look senoidal que conecta los puntos.
//
// Datos: useSalesTimeseries → GET /sales/timeseries (agregado por mes/día, real).
// Recharts en Remix: ResponsiveContainer mide el DOM, así que renderizamos el chart
// solo tras montar en cliente (guard `mounted`) para evitar warnings de width:0 e
// inconsistencias de hidratación. Mientras tanto: skeleton con la forma del chart.
import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
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
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-text">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 capitalize text-muted">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="nums font-semibold text-text">{formatCordobas(Number(entry.value))}</span>
        </p>
      ))}
    </div>
  );
}

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

  // El vendedor ve SUS comisiones; el admin, ventas vs ganancia de la tienda.
  const title = isAdmin ? "Rendimiento de ventas" : "Mis comisiones";
  const emptyMsg = isAdmin
    ? "Sin ventas aprobadas en este período."
    : "Sin comisiones aprobadas en este período.";

  return (
    <WidgetShell title={title} icon={TrendingUp} tone="emerald">
      {!mounted || (isLoading && chartData.length === 0) ? (
        <ChartSkeleton />
      ) : chartData.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center text-center">
          <p className="text-sm text-muted">{emptyMsg}</p>
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 20, right: 16, left: 8, bottom: 4 }}>
              <defs>
                <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradGanancia" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradComision" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-whatsapp)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--color-whatsapp)" stopOpacity={0} />
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
                padding={{ left: 16, right: 16 }}
              />
              <YAxis
                tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={48}
                allowDecimals={false}
                // Headroom amplio: el pico queda a ~60% de altura (la curva "flota" abajo).
                domain={[0, (dataMax: number) => Math.ceil((dataMax * 1.7) / 1000) * 1000]}
                tickFormatter={(v) => {
                  const n = Number(v);
                  return n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`;
                }}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--color-border)" }} />
              {/* type="natural" → spline suave (look senoidal) que conecta los puntos. */}
              {isAdmin ? (
                <>
                  <Area
                    type="natural"
                    dataKey="ventas"
                    name="ventas"
                    stroke="var(--color-accent)"
                    strokeWidth={2}
                    fill="url(#gradVentas)"
                    animationDuration={700}
                  />
                  <Area
                    type="natural"
                    dataKey="ganancia"
                    name="ganancia"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#gradGanancia)"
                    animationDuration={900}
                  />
                </>
              ) : (
                <Area
                  type="natural"
                  dataKey="comision"
                  name="comisión"
                  stroke="var(--color-whatsapp)"
                  strokeWidth={2.5}
                  fill="url(#gradComision)"
                  dot={{ r: 3, fill: "var(--color-whatsapp)", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  animationDuration={700}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </WidgetShell>
  );
}
