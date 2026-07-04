// Vista unificada de "Pérdidas y Gastos" (sin sub-tabs): cards de resumen + botón que
// despliega el formulario + tabla única con filtros. Trae la data una sola vez y la
// reparte a sus piezas presentacionales.
import { useGetLossesQuery } from "~/store/api/reportsApi";
import { ReportsSummaryCards } from "./ReportsSummaryCards";
import { RegisterPanel } from "./RegisterPanel";
import { RecordsTable } from "./RecordsTable";

export function LossesPanel({ year, month }: { year: number; month: number | "all" }) {
  const monthParam = month === "all" ? null : month;
  const { data: records = [] } = useGetLossesQuery({ year, month: monthParam });

  return (
    <div className="space-y-5">
      <ReportsSummaryCards records={records} />
      <RegisterPanel />
      <RecordsTable records={records} />
    </div>
  );
}
