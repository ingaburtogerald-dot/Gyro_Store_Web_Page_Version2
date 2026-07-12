// KPIs principales del reporte (mes o año completo). Cada tarjeta muestra el
// valor en C$ y su equivalente en USD (a la tasa fija).
// Jerarquía en dos niveles: fila "hero" con el resultado (orden de P&L) y
// debajo el desglose agrupado en Capital y Deducciones.
import { TrendingUp, DollarSign, Receipt, Truck, Coins, Wallet, AlertTriangle, Percent, Landmark, PiggyBank, ReceiptText, Banknote } from "lucide-react";
import { StatCard } from "~/components/ui/Card";
import type { ReportKpisData } from "~/store/api/reportsApi";
import { formatCordobas, formatUsd } from "~/lib/utils";
import { EXCHANGE_RATE } from "~/lib/constants";

// Equivalente en USD (mismo monto, a la tasa fija).
const usdOf = (cordobas: number) => formatUsd(cordobas / EXCHANGE_RATE);
// Escalonado de entrada según posición global de la tarjeta.
const delayAt = (i: number) => i * 0.04;

export function ReportKpis({ kpis }: { kpis: ReportKpisData }) {
  const impuestosC = kpis.impuestosUsd * EXCHANGE_RATE;
  const enviosC = kpis.enviosUsd * EXCHANGE_RATE;
  const gastosC = kpis.gastosExcedenteCordobas + kpis.gastosVariosCordobas;

  return (
    <div className="space-y-4">
      {/* Nivel 1: resultado del período */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="Ventas" countTo={kpis.ventasCordobas} format={formatCordobas} sub={usdOf(kpis.ventasCordobas)} color="indigo" delay={delayAt(0)} />
        <StatCard icon={Landmark} label="Ganancia tienda" countTo={kpis.gananciaTiendaCordobas} format={formatCordobas} sub={usdOf(kpis.gananciaTiendaCordobas)} delay={delayAt(1)} />
        <StatCard icon={Wallet} label="Ganancia neta" countTo={kpis.gananciaNetaCordobas} format={formatCordobas} sub={usdOf(kpis.gananciaNetaCordobas)} color="emerald" delay={delayAt(2)} />
        <StatCard icon={Percent} label="Margen s/ inversión" countTo={kpis.margenPct} format={(n) => `${n.toFixed(1)}%`} delay={delayAt(3)} />
      </div>

      <KpiGroup title="Capital">
        <StatCard icon={DollarSign} label="Inversión" countTo={kpis.inversionCordobas} format={formatCordobas} sub={formatUsd(kpis.inversionUsd)} delay={delayAt(4)} />
        <StatCard icon={Banknote} label="Inversión recuperada" countTo={kpis.totalCostoVentaCordobas} format={formatCordobas} sub={usdOf(kpis.totalCostoVentaCordobas)} delay={delayAt(5)} />
        <StatCard icon={Receipt} label="Impuestos" countTo={impuestosC} format={formatCordobas} sub={formatUsd(kpis.impuestosUsd)} delay={delayAt(6)} />
        <StatCard icon={Truck} label="Envíos" countTo={enviosC} format={formatCordobas} sub={formatUsd(kpis.enviosUsd)} delay={delayAt(7)} />
      </KpiGroup>

      <KpiGroup title="Deducciones">
        <StatCard icon={Coins} label="Comisiones" countTo={kpis.comisionesCordobas} format={formatCordobas} sub={usdOf(kpis.comisionesCordobas)} delay={delayAt(8)} />
        <StatCard icon={PiggyBank} label="Costos fijos" countTo={kpis.costosFijosCordobas} format={formatCordobas} sub={usdOf(kpis.costosFijosCordobas)} delay={delayAt(9)} />
        <StatCard icon={AlertTriangle} label="Pérdidas inventario" countTo={kpis.perdidasInventarioCordobas} format={formatCordobas} sub={usdOf(kpis.perdidasInventarioCordobas)} color="rose" delay={delayAt(10)} />
        <StatCard
          icon={ReceiptText}
          label="Gastos (sobre presup.)"
          hint="Solo el gasto que excede el presupuesto de cada grupo, más los gastos varios (sin pozo)."
          countTo={gastosC}
          format={formatCordobas}
          sub={usdOf(gastosC)}
          color="rose"
          delay={delayAt(11)}
        />
      </KpiGroup>
    </div>
  );
}

function KpiGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">{title}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
    </section>
  );
}
