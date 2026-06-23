// Portal de Reportería: dashboard con filtro de mes, gráficos, pérdidas y exportación.
import { useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { motion } from "framer-motion";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { RequireRole } from "~/components/admin/RequireRole";
import { ReportKpis } from "~/components/admin/reports/ReportKpis";
import { ReportCharts } from "~/components/admin/reports/ReportCharts";
import { BudgetTable } from "~/components/admin/reports/BudgetTable";
import { LossesPanel } from "~/components/admin/reports/LossesPanel";
import { Button } from "~/components/ui/Button";
import { TabBtn } from "~/components/ui/TabBtn";
import { Skeleton } from "~/components/ui/Skeleton";
import { useGetReportQuery } from "~/store/api/reportsApi";
import { exportXlsx } from "~/lib/exportXlsx";

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function Reportes() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | "all">(now.getMonth());
  const [tab, setTab] = useState<"dashboard" | "losses">("dashboard");

  const { data, isLoading } = useGetReportQuery({ year, month: month === "all" ? null : month });

  const yearOptions = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];
  const periodLabel = month === "all" ? `Año ${year}` : `${MONTH_NAMES[month]} ${year}`;
  const slug = month === "all" ? `${year}` : `${year}-${String(month + 1).padStart(2, "0")}`;

  const sheetRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: sheetRef, documentTitle: `reporte-${slug}` });

  function exportExcel() {
    if (!data) return;
    exportXlsx(`reporte-${slug}`, [
      { name: "KPIs", rows: [data.kpis as unknown as Record<string, unknown>] },
      { name: "Mensual", rows: data.charts.monthly },
      { name: "Vendedores", rows: data.charts.performance },
      { name: "CostosFijos", rows: data.charts.costosFijos },
      { name: "PresupuestoVsGasto", rows: data.charts.presupuestoVsGasto as unknown as Record<string, unknown>[] },
    ]);
  }

  return (
    <RequireRole allowed={["admin"]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="gradient-text text-2xl font-bold">Reportería</h1>
            <p className="text-muted">
              KPIs, gráficos y pérdidas — <span className="font-semibold text-text">{periodLabel}</span>.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Año</span>
              <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {yearOptions.map((yy) => (
                  <option key={yy} value={yy}>{yy}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Mes</span>
              <select
                className="input"
                value={month}
                onChange={(e) => setMonth(e.target.value === "all" ? "all" : Number(e.target.value))}
              >
                <option value="all">Todo el año</option>
                {MONTH_NAMES.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
            </label>
            <Button variant="outline" onClick={exportExcel} disabled={!data}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={!data}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
          </div>
        </div>

        <div className="flex gap-1 rounded-pill border border-border bg-surface p-1 sm:w-fit">
          <TabBtn active={tab === "dashboard"} onClick={() => setTab("dashboard")}>Dashboard</TabBtn>
          <TabBtn active={tab === "losses"} onClick={() => setTab("losses")}>Pérdidas y gastos</TabBtn>
        </div>

        {tab === "dashboard" ? (
          isLoading || !data ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-card" />
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-72 rounded-card" />
                ))}
              </div>
            </div>
          ) : (
            <motion.div ref={sheetRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 bg-bg">
              <ReportKpis kpis={data.kpis} />
              <BudgetTable rows={data.charts.presupuestoVsGasto} />
              <ReportCharts charts={data.charts} />
            </motion.div>
          )
        ) : (
          <LossesPanel />
        )}
      </div>
    </RequireRole>
  );
}

