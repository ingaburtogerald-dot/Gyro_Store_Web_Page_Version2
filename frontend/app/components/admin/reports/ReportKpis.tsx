// KPIs principales del reporte (mes o año completo). Cada tarjeta muestra el
// valor en C$ y su equivalente en USD (a la tasa fija).
import { TrendingUp, DollarSign, Receipt, Truck, Coins, Wallet, AlertTriangle, Percent, Landmark, PiggyBank, ReceiptText, Banknote } from "lucide-react";
import { StatCard } from "~/components/ui/StatCard";
import type { ReportKpisData } from "~/store/api/reportsApi";
import { formatCordobas, formatUsd } from "~/lib/utils";
import { EXCHANGE_RATE } from "~/lib/constants";

// Equivalente en USD (mismo monto, a la tasa fija de 37).
const usdOf = (cordobas: number) => formatUsd(cordobas / EXCHANGE_RATE);

export function ReportKpis({ kpis }: { kpis: ReportKpisData }) {
  const impuestosC = kpis.impuestosUsd * EXCHANGE_RATE;
  const enviosC = kpis.enviosUsd * EXCHANGE_RATE;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard icon={DollarSign} label="Inversión" countTo={kpis.inversionCordobas} format={formatCordobas} sub={formatUsd(kpis.inversionUsd)} delay={0} />
      <StatCard icon={Receipt} label="Impuestos" countTo={impuestosC} format={formatCordobas} sub={formatUsd(kpis.impuestosUsd)} delay={0.04} />
      <StatCard icon={Truck} label="Envíos" countTo={enviosC} format={formatCordobas} sub={formatUsd(kpis.enviosUsd)} delay={0.08} />
      <StatCard icon={TrendingUp} label="Ventas" countTo={kpis.ventasCordobas} format={formatCordobas} sub={usdOf(kpis.ventasCordobas)} color="indigo" delay={0.12} />
      <StatCard icon={Banknote} label="Inversión recuperada" countTo={kpis.totalCostoVentaCordobas ?? 0} format={formatCordobas} sub={usdOf(kpis.totalCostoVentaCordobas ?? 0)} delay={0.16} />
      <StatCard icon={Coins} label="Comisiones" countTo={kpis.comisionesCordobas} format={formatCordobas} sub={usdOf(kpis.comisionesCordobas)} delay={0.2} />
      <StatCard icon={PiggyBank} label="Costos fijos" countTo={kpis.costosFijosCordobas ?? 0} format={formatCordobas} sub={usdOf(kpis.costosFijosCordobas ?? 0)} delay={0.2} />
      <StatCard icon={Landmark} label="Ganancia tienda" countTo={kpis.gananciaTiendaCordobas ?? 0} format={formatCordobas} sub={usdOf(kpis.gananciaTiendaCordobas ?? 0)} delay={0.24} />
      <StatCard icon={AlertTriangle} label="Pérdidas inventario" countTo={kpis.perdidasInventarioCordobas ?? kpis.perdidasCordobas} format={formatCordobas} sub={usdOf(kpis.perdidasInventarioCordobas ?? kpis.perdidasCordobas)} color="rose" delay={0.28} />
      <StatCard icon={ReceiptText} label="Gastos (sobre presup.)" countTo={(kpis.gastosExcedenteCordobas ?? 0) + (kpis.gastosVariosCordobas ?? 0)} format={formatCordobas} sub={usdOf((kpis.gastosExcedenteCordobas ?? 0) + (kpis.gastosVariosCordobas ?? 0))} color="rose" delay={0.32} />
      <StatCard icon={Wallet} label="Ganancia neta" countTo={kpis.gananciaNetaCordobas} format={formatCordobas} sub={usdOf(kpis.gananciaNetaCordobas)} color="emerald" delay={0.36} />
      <StatCard icon={Percent} label="Margen s/ inversión" countTo={kpis.margenPct} format={(n) => `${Math.round(n)}%`} delay={0.4} />
    </div>
  );
}
