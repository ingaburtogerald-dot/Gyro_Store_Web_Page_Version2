// Cards de resumen de pérdidas y gastos. Totales en C$ (USD→C$ con EXCHANGE_RATE),
// calculados por el dominio (summarizeRecords). Render con el <KpiGrid/> compartido.
import { TrendingDown, Receipt, Sigma, ListChecks } from "lucide-react";
import { KpiGrid, type KpiCardSpec } from "~/components/shared/KpiGrid";
import { summarizeRecords } from "~/domain/reports/recordSummary";
import { EXCHANGE_RATE } from "~/lib/constants";
import type { LossRecord } from "~/store/api/reportsApi";

export function ReportsSummaryCards({ records }: { records: LossRecord[] }) {
  const s = summarizeRecords(records, EXCHANGE_RATE);

  const cards: KpiCardSpec[] = [
    { key: "perdidas", icon: TrendingDown, label: "Pérdidas", value: s.perdidas, money: true, color: "rose" },
    { key: "gastos", icon: Receipt, label: "Gastos", value: s.gastos, money: true, color: "amber" },
    { key: "total", icon: Sigma, label: "Total deducciones", value: s.total, money: true, color: "indigo" },
    { key: "count", icon: ListChecks, label: "Movimientos", value: s.count, color: "neutral" },
  ];

  return <KpiGrid cards={cards} className="grid-cols-2 lg:grid-cols-4" />;
}
