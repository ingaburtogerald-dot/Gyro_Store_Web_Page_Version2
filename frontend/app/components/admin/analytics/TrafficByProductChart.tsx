import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "~/components/ui/Skeleton";
import { PanelHeader, CountTooltip, EmptyRows } from "./shared";
import type { SearchAnalytics } from "~/store/api/searchAnalyticsApi";

const COL_VISITS = "var(--color-badge)";

export function TrafficByProductChart({
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
