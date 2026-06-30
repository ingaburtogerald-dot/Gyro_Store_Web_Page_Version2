// ─────────────────────────────────────────────────────────────────────────────
// Capa de Dominio — Cálculos financieros PUROS del módulo de ventas.
//
// Reglas:
//   • Cero React, cero side-effects, cero formato de presentación → 100% testeable.
//   • Única fuente de verdad de la matemática financiera. Si un número se calcula
//     en un componente, está en el lugar equivocado: debe vivir aquí.
//
// Contexto: una venta trae sus financieros a veces por línea (costReal) y a veces
// como total agregado (totalCostReal). `resolveSaleFinancials` resuelve esa dualidad
// en un solo punto, eliminando los `?? ` repartidos por toda la UI.
// ─────────────────────────────────────────────────────────────────────────────
import type { Sale } from "~/store/api/salesApi";

const n = (v: number | undefined | null): number => v ?? 0;

/** Vista financiera normalizada de una venta (modelo de dominio que consume la UI). */
export interface SaleFinancials {
  saleTotal: number;
  costReal: number;
  utilidadBruta: number;
  costosFijos: number;
  utilidadNeta: number;
  comisionVendedor: number;
  gananciaTienda: number;
  /** Derivado: lo recuperado de la inversión = venta − costo real. */
  inversionRecuperada: number;
}

/** Normaliza los financieros de una venta resolviendo línea vs. total. */
export function resolveSaleFinancials(sale: Sale): SaleFinancials {
  const saleTotal = n(sale.saleTotal);
  const costReal = sale.costReal ?? sale.totalCostReal ?? 0;
  return {
    saleTotal,
    costReal,
    utilidadBruta: sale.utilidadBruta ?? sale.totalUtilidadBruta ?? 0,
    costosFijos: sale.costosFijos ?? sale.totalCostosFijos ?? 0,
    utilidadNeta: sale.utilidadNeta ?? sale.totalUtilidadNeta ?? 0,
    comisionVendedor: n(sale.comisionVendedor),
    gananciaTienda: n(sale.gananciaTienda),
    inversionRecuperada: saleTotal - costReal,
  };
}

/** Totales agregados que alimentan el <KpiSummary /> (admin y vendedor). */
export interface KpiTotals {
  totalVendido: number;
  inversion: number;
  comisiones: number;
  ganancia: number;
}

const EMPTY_TOTALS: KpiTotals = { totalVendido: 0, inversion: 0, comisiones: 0, ganancia: 0 };

/** Suma los KPIs sobre una lista de ventas (la MISMA lista que ve la tabla/grilla). */
export function sumKpiTotals(sales: Sale[]): KpiTotals {
  return sales.reduce<KpiTotals>((acc, s) => {
    const f = resolveSaleFinancials(s);
    acc.totalVendido += f.saleTotal;
    acc.inversion += f.costReal;
    acc.comisiones += f.comisionVendedor;
    acc.ganancia += f.gananciaTienda;
    return acc;
  }, { ...EMPTY_TOTALS });
}

/** Comisión total de un grupo de ventas (base del pago al vendedor). */
export function sumComision(sales: Sale[]): number {
  return sales.reduce((acc, s) => acc + n(s.comisionVendedor), 0);
}

export interface Payout {
  totalComision: number;
  saldo: number;
  /** Comisión + saldo de ajustes, nunca negativo (el resto queda para el próximo pago). */
  totalAPagar: number;
}

/** Pago final de un lote aplicando el saldo (ajustes de comisión) del vendedor. */
export function computePayout(sales: Sale[], saldo: number): Payout {
  const totalComision = sumComision(sales);
  const totalAPagar = Math.max(0, Math.round((totalComision + saldo) * 100) / 100);
  return { totalComision, saldo, totalAPagar };
}

/** Cantidad total de unidades de una venta (suma de líneas). */
export function totalQuantity(sale: Sale): number {
  return (sale.items ?? []).reduce((sum, it) => sum + (it.quantity || 0), 0);
}
