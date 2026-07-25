import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "~/components/ui/Skeleton";
import { PanelHeader, CountTooltip, Legend2, EmptyRows } from "./shared";
import type { SearchAnalytics } from "~/store/api/searchAnalyticsApi";

const COL_VISITS = "var(--color-badge)";
const COL_SEARCHES = "var(--color-accent)";

export function TrafficVsSearchChart({ data, mounted }: { data: SearchAnalytics; mounted: boolean }) {
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
