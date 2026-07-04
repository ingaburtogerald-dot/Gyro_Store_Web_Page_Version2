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

/** Extrae el desglose de costos fijos sumando items, soportando estructuras viejas y nuevas. */
export function extractCostosFijosDesglose(sale: Sale) {
  // Preferimos el agregado a nivel venta si existe (ventas nuevas):
  if (sale.cfDesglose && Object.keys(sale.cfDesglose).length > 0) return { ...sale.cfDesglose };
  
  // Fallback a sumatoria por ítem (ventas legacy migradas):
  const desglose: Record<string, number> = {};
  if (sale.items) {
    for (const it of sale.items) {
      if (it.costosFijosDesglose) {
        for (const [k, v] of Object.entries(it.costosFijosDesglose)) {
          if (!desglose[k]) desglose[k] = 0;
          desglose[k] += (v as number) * (it.quantity || 1);
        }
      }
    }
  }
  return desglose;
}

/** 
 * Agrupa los items de una venta por código y precio de venta.
 * Si tienen el mismo código y el mismo precio, se unifican.
 * De lo contrario, se separan.
 */
export function groupSaleItems(items: any[]): any[] {
  if (!items || !Array.isArray(items)) return [];
  const grouped: Record<string, any> = {};
  for (const it of items) {
    // Normalizamos el código (trim y minúsculas)
    const rawCode = it.code || it.productId || "";
    const codeStr = String(rawCode).trim().toLowerCase();
    
    // Obtenemos el precio, si no hay salePrice explícito intentamos derivarlo
    let price = it.salePrice;
    if (price === undefined || price === null) {
      if (typeof it.lineTotal === "number" && typeof it.quantity === "number" && it.quantity > 0) {
        price = it.lineTotal / it.quantity;
      } else {
        price = 0;
      }
    }
    const priceStr = Number(price).toFixed(2);

    const key = `${codeStr}-${priceStr}`;
    
    if (!grouped[key]) {
      grouped[key] = { ...it };
    } else {
      grouped[key].quantity = (grouped[key].quantity || 1) + (it.quantity || 1);
      
      const sumField = (field: string) => {
         if (it[field] !== undefined && it[field] !== null) {
            grouped[key][field] = (grouped[key][field] || 0) + it[field];
         }
      };
      
      sumField("lineTotal");
      sumField("costReal");
      sumField("utilidadBruta");
      sumField("costosFijos");
      sumField("utilidadNeta");
      sumField("comisionVendedor");
      sumField("gananciaTienda");
      sumField("inversionRecuperada");
    }
  }
  return Object.values(grouped);
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
