// Dashboard de gráficas de reportería. Dos visualizaciones enfocadas y legibles:
//   1. Costos fijos: barras horizontales ordenadas con %.
//   2. Vendedores: leaderboard con barras de progreso.
import { motion } from "framer-motion";
import type { ReportData } from "~/store/api/reportsApi";
import { ChartCard, gridVariants } from "./charts/chartPrimitives";
import { CostBreakdown } from "./charts/CostBreakdown";
import { SellerLeaderboard } from "./charts/SellerLeaderboard";

export function ReportCharts({ charts }: { charts: ReportData["charts"] }) {
  const costosTotal = charts.costosFijos.reduce((s, c) => s + c.value, 0);

  return (
    <motion.div variants={gridVariants} initial="hidden" animate="show" className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Distribución de costos fijos" empty={costosTotal === 0}>
        <CostBreakdown data={charts.costosFijos} />
      </ChartCard>

      <ChartCard title="Ranking de vendedores" subtitle="Vendido vs. el líder del período" empty={!charts.performance.length}>
        <SellerLeaderboard data={charts.performance} />
      </ChartCard>
    </motion.div>
  );
}
