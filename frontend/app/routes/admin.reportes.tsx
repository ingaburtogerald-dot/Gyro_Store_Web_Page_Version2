// Portal de Reportería: dashboard con filtro de mes, gráficos, pérdidas y exportación.
import { useRef, useState } from "react";
import { useSearchParams } from "@remix-run/react";
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
import type { ReportKpisData } from "~/store/api/reportsApi";
import { exportXlsx } from "~/lib/exportXlsx";
import { EXCHANGE_RATE } from "~/lib/constants";

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

// Hoja "KPIs" del Excel con etiquetas legibles (formato P&L: concepto | C$ | USD),
// en vez de una fila con las claves crudas del API.
function kpiSheetRows(k: ReportKpisData) {
  const usd = (c: number) => Math.round((c / EXCHANGE_RATE) * 100) / 100;
  return [
    { Concepto: "Ventas", "C$": k.ventasCordobas, USD: usd(k.ventasCordobas) },
    { Concepto: "Inversión recuperada (costo de venta)", "C$": k.totalCostoVentaCordobas, USD: usd(k.totalCostoVentaCordobas) },
    { Concepto: "Ganancia tienda", "C$": k.gananciaTiendaCordobas, USD: usd(k.gananciaTiendaCordobas) },
    { Concepto: "Comisiones", "C$": k.comisionesCordobas, USD: usd(k.comisionesCordobas) },
    { Concepto: "Costos fijos", "C$": k.costosFijosCordobas, USD: usd(k.costosFijosCordobas) },
    { Concepto: "Pérdidas de inventario", "C$": k.perdidasInventarioCordobas, USD: usd(k.perdidasInventarioCordobas) },
    { Concepto: "Gastos (excedente de presupuesto)", "C$": k.gastosExcedenteCordobas, USD: usd(k.gastosExcedenteCordobas) },
    { Concepto: "Gastos varios", "C$": k.gastosVariosCordobas, USD: usd(k.gastosVariosCordobas) },
    { Concepto: "Ganancia neta", "C$": k.gananciaNetaCordobas, USD: usd(k.gananciaNetaCordobas) },
    { Concepto: "Inversión", "C$": k.inversionCordobas, USD: k.inversionUsd },
    { Concepto: "Impuestos", "C$": Math.round(k.impuestosUsd * EXCHANGE_RATE), USD: k.impuestosUsd },
    { Concepto: "Envíos", "C$": Math.round(k.enviosUsd * EXCHANGE_RATE), USD: k.enviosUsd },
    { Concepto: "Margen s/ inversión", "C$": `${k.margenPct}%`, USD: "" },
  ];
}

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
  const slug = month === "all" ? `${year}` : `${year}-${String(month + 1).padStart(2, "0")}`;

  const sheetRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: sheetRef, documentTitle: `reporte-${slug}` });

  function exportExcel() {
    if (!data) return;
    exportXlsx(`reporte-${slug}`, [
      { name: "KPIs", rows: kpiSheetRows(data.kpis) },
      { name: "Mensual", rows: data.charts.monthly },
      { name: "Vendedores", rows: data.charts.performance },
      { name: "CostosFijos", rows: data.charts.costosFijos },
      { name: "PresupuestoVsGasto", rows: data.charts.presupuestoVsGasto },
    ]);
  }

  // Sin datos previos → skeleton; cambiando de período → atenuar la data anterior
  // para que no se lean cifras del mes equivocado.
  const exportDisabled = !data || isFetching;

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
                {YEAR_OPTIONS.map((yy) => (
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
            <Button variant="outline" onClick={exportExcel} disabled={exportDisabled}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={exportDisabled}>
              <FileDown className="h-4 w-4" /> Imprimir / PDF
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
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-card" />
                ))}
              </div>
              <Skeleton className="h-48 rounded-card" />
              <div className="grid gap-4 lg:grid-cols-2">
                <Skeleton className="h-[340px] rounded-card lg:col-span-2" />
                <Skeleton className="h-[300px] rounded-card" />
                <Skeleton className="h-[300px] rounded-card" />
                <Skeleton className="h-[300px] rounded-card lg:col-span-2" />
              </div>
            </div>
          ) : (
            <motion.div
              ref={sheetRef}
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
