// Portal de Reportería: dashboard con selector de período unificado, gráficos y pérdidas.
import { useState } from "react";
import { useSearchParams } from "@remix-run/react";
import { motion } from "framer-motion";
import { RequireRole } from "~/components/admin/RequireRole";
import { ReportKpis } from "~/components/admin/reports/ReportKpis";
import { ReportCharts } from "~/components/admin/reports/ReportCharts";
import { BudgetTable } from "~/components/admin/reports/BudgetTable";
import { LossesPanel } from "~/components/admin/reports/LossesPanel";
import { MonthPicker } from "~/components/admin/reports/_shared/MonthPicker";
import { TabBtn } from "~/components/ui/TabBtn";
import { Skeleton } from "~/components/ui/Skeleton";
import { useGetReportQuery } from "~/store/api/reportsApi";

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = CURRENT_YEAR - 2;

export default function Reportes() {
  const [searchParams] = useSearchParams();
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState<number | "all">(() => new Date().getMonth());
  // ?tab=losses permite deep-link directo a Pérdidas y gastos (quick-create del header).
  const [tab, setTab] = useState<"dashboard" | "losses">(
    searchParams.get("tab") === "losses" ? "losses" : "dashboard",
  );

  const { data, isLoading, isFetching } = useGetReportQuery({ year, month: month === "all" ? null : month });

  const periodLabel = month === "all" ? `Año ${year}` : `${MONTH_NAMES[month]} ${year}`;

  return (
    <RequireRole allowed={["admin"]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text">Reportería</h1>
            <p className="text-muted">
              KPIs, gráficos y pérdidas — <span className="font-semibold text-text">{periodLabel}</span>.
            </p>
          </div>

          {/* Selector de período unificado (mes + año en un solo control) */}
          <MonthPicker
            year={year}
            month={month}
            minYear={MIN_YEAR}
            maxYear={CURRENT_YEAR}
            onChange={(y, m) => { setYear(y); setMonth(m); }}
          />
        </div>

        <div className="flex gap-1 rounded-pill border border-border bg-surface p-1 sm:w-fit">
          <TabBtn active={tab === "dashboard"} onClick={() => setTab("dashboard")}>Dashboard</TabBtn>
          <TabBtn active={tab === "losses"} onClick={() => setTab("losses")}>Pérdidas y gastos</TabBtn>
        </div>

        {tab === "dashboard" ? (
          isLoading || !data ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-card" />
                ))}
              </div>
              <Skeleton className="h-48 rounded-card" />
              <div className="grid gap-4 lg:grid-cols-2">
                <Skeleton className="h-[320px] rounded-card" />
                <Skeleton className="h-[320px] rounded-card" />
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              aria-busy={isFetching}
              className={`space-y-6 bg-bg transition-opacity duration-200 ${isFetching ? "pointer-events-none opacity-50" : ""}`}
            >
              <ReportKpis kpis={data.kpis} />
              <BudgetTable rows={data.charts.presupuestoVsGasto} />
              <ReportCharts charts={data.charts} />
            </motion.div>
          )
        ) : (
          <LossesPanel year={year} month={month} />
        )}
      </div>
    </RequireRole>
  );
}
