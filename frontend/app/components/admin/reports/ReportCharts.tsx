// Gráficos del dashboard de reportes (Recharts).
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ReportData } from "~/store/api/reportsApi";
import { formatCordobas, formatUsd } from "~/lib/utils";
import { EXCHANGE_RATE } from "~/lib/constants";

const COLORS = ["#10b981", "#34d399", "#38bdf8", "#f59e0b", "#a855f7"];
// Paleta más amplia para diferenciar cada vendedor por color (lidera el esmeralda).
const SELLER_COLORS = ["#10b981", "#38bdf8", "#f59e0b", "#a855f7", "#f43f5e", "#34d399", "#eab308", "#ec4899", "#14b8a6", "#6366f1"];
const axis = { stroke: "#717a9c", fontSize: 12 };
const tooltipStyle = { background: "#12121a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, color: "#e2e8f0" };

// Tooltip que muestra cada valor en C$ y su equivalente en USD (tasa 37).
function MoneyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={tooltipStyle} className="px-3 py-2 text-xs">
      {label && <div className="mb-1 font-semibold text-text">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color || p.fill || "#e2e8f0" }}>
          {p.name}: <strong>{formatCordobas(p.value || 0)}</strong> · {formatUsd((p.value || 0) / EXCHANGE_RATE)}
        </div>
      ))}
    </div>
  );
}

export function ReportCharts({ charts }: { charts: ReportData["charts"] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Inversión vs. Ventas (C$)">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={charts.monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" {...axis} />
            <YAxis {...axis} />
            <Tooltip content={<MoneyTooltip />} />
            <Legend />
            <Bar dataKey="inversion" name="Inversión" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ventas" name="Ventas" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Distribución de costos fijos">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={charts.costosFijos} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90}>
              {charts.costosFijos.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<MoneyTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Ventas vs. Ganancia (C$) — año">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={charts.monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" {...axis} />
            <YAxis {...axis} />
            <Tooltip content={<MoneyTooltip />} />
            <Legend />
            <Line type="monotone" dataKey="ventas" name="Ventas" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="ganancia" name="Ganancia tienda" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Performance de vendedores (C$)">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={charts.performance} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis type="number" {...axis} />
            <YAxis type="category" dataKey="sellerName" width={90} {...axis} />
            <Tooltip content={<MoneyTooltip />} />
            <Bar dataKey="totalVendido" name="Vendido" radius={[0, 4, 4, 0]}>
              {charts.performance.map((_, i) => (
                <Cell key={i} fill={SELLER_COLORS[i % SELLER_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Comisiones por vendedor (C$)">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={charts.performance} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis type="number" {...axis} />
            <YAxis type="category" dataKey="sellerName" width={90} {...axis} />
            <Tooltip content={<MoneyTooltip />} />
            <Bar dataKey="comisiones" name="Comisión" radius={[0, 4, 4, 0]}>
              {charts.performance.map((_, i) => (
                <Cell key={i} fill={SELLER_COLORS[i % SELLER_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Ganancia neta vs. Comisiones (C$)">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={charts.monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" {...axis} />
            <YAxis {...axis} />
            <Tooltip content={<MoneyTooltip />} />
            <Legend />
            <Bar dataKey="gananciaNeta" name="Ganancia neta" fill="#00d4aa" radius={[4, 4, 0, 0]} />
            <Bar dataKey="comisiones" name="Comisiones" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {children}
    </div>
  );
}
