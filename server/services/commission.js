// Lógica de negocio de ventas: comisiones y rentabilidad. CENTRALIZADA aquí para
// que el cotizador (estimación) y la aprobación (definitivo) usen exactamente la
// misma fórmula. NO duplicar estas cuentas en ninguna otra parte.
const { db } = require('../firebase');
const config = require('../config');

// Paso 5 — Comisión del vendedor: Tasa plana inteligente dinámica según saleTotal
function getDynamicMargins(saleTotal) {
  if (saleTotal < 500) {
    return { costosFijosPct: 20, comisionPct: 40 };
  } else if (saleTotal < 1000) {
    return { costosFijosPct: 18, comisionPct: 37 };
  } else if (saleTotal < 2000) {
    return { costosFijosPct: 16, comisionPct: 35 };
  } else if (saleTotal < 4000) {
    return { costosFijosPct: 14, comisionPct: 30 };
  } else if (saleTotal <= 7000) {
    return { costosFijosPct: 12, comisionPct: 25 };
  } else {
    // Para facturas mayores a 7000 córdobas, mantenemos por ahora el mismo margen del rango anterior (12% FC y 25% comisión)
    return { costosFijosPct: 12, comisionPct: 25 };
  }
}

// Paso 5 — Comisión del vendedor: Tasa plana inteligente dinámica según saleTotal
function calcularComisionYPorcentaje(utilidadNeta, saleTotal = 0) {
  if (utilidadNeta <= 0) return { amount: 0, percent: 0 };
  const { comisionPct } = getDynamicMargins(saleTotal);
  return { amount: utilidadNeta * (comisionPct / 100), percent: comisionPct };
}

function calcularComision(utilidadNeta, saleTotal = 0) {
  return calcularComisionYPorcentaje(utilidadNeta, saleTotal).amount;
}

// Lee el % total de costos fijos desde app_config (configurable) o usa el default.
async function getCostosFijosPct() {
  try {
    const doc = await db.collection(config.collections.appConfig).doc('business').get();
    const cf = doc.exists ? doc.data().costosFijos : null;
    const source = cf && typeof cf === 'object' ? cf : config.costosFijos;
    return Object.values(source).reduce((sum, v) => sum + (Number(v) || 0), 0);
  } catch {
    return Object.values(config.costosFijos).reduce((sum, v) => sum + v, 0);
  }
}

// Lee el desglose completo de costos fijos { publicidad, servicios, utiles, garantias }
// desde app_config o usa el default del config.js.
async function getCostosFijosConfig() {
  try {
    const doc = await db.collection(config.collections.appConfig).doc('business').get();
    const cf = doc.exists ? doc.data().costosFijos : null;
    return cf && typeof cf === 'object' ? cf : config.costosFijos;
  } catch {
    return config.costosFijos;
  }
}

// costosFijosConfig es opcional: { publicidad: 10, servicios: 5, utiles: 5, garantias: 5 }.
// Si se pasa, cada línea incluirá el desglose por categoría de costos fijos.
function computeFinancials({ lines, costosFijosConfig }) {
  let costRealTotal = 0, utilidadBrutaTotal = 0, utilidadNetaTotal = 0, comisionVendedorTotal = 0, gananciaTiendaTotal = 0, costosFijosTotal = 0, saleTotal = 0;
  const linesFinancials = [];

  // Precalcular la suma de los % de costos fijos para repartir proporcionalmente.
  const cfEntries = costosFijosConfig ? Object.entries(costosFijosConfig) : [];
  const cfSumPct = cfEntries.reduce((s, [, v]) => s + (Number(v) || 0), 0);

  for (const line of lines) {
    const unitPrice = line.salePrice || 0;
    const qty = line.quantity || 1;
    const lineTotal = unitPrice * qty;
    const lineCost = line.lineCost || 0;
    const unitCost = qty > 0 ? lineCost / qty : 0;
    
    // Márgenes basados en PRECIO UNITARIO
    const { costosFijosPct: dynamicPct, comisionPct } = getDynamicMargins(unitPrice);
    
    const unitUB = unitPrice - unitCost;
    const unitCF = unitUB * (dynamicPct / 100);
    const unitUN = unitUB - unitCF;
    const unitComision = unitUN > 0 ? unitUN * (comisionPct / 100) : 0;
    
    const ubLine = unitUB * qty;
    const cfLine = unitCF * qty;
    const unLine = unitUN * qty;
    const comisionLine = unitComision * qty;
    const gananciaLine = unLine - comisionLine;
    
    saleTotal += lineTotal;
    costRealTotal += lineCost;
    utilidadBrutaTotal += ubLine;
    costosFijosTotal += cfLine;
    utilidadNetaTotal += unLine;
    comisionVendedorTotal += comisionLine;
    gananciaTiendaTotal += gananciaLine;

    // Desglose de costos fijos por categoría POR UNIDAD (proporcional al config).
    let unitCostosFijosDesglose = null;
    let costosFijosDesglose = null;
    if (costosFijosConfig && cfSumPct > 0) {
      unitCostosFijosDesglose = {};
      costosFijosDesglose = {};
      for (const [k, v] of cfEntries) {
        unitCostosFijosDesglose[k] = round(unitCF * (Number(v) / cfSumPct));
        costosFijosDesglose[k] = round(unitCF * (Number(v) / cfSumPct) * qty);
      }
    }

    const unitGanancia = unitUN - unitComision;

    linesFinancials.push({
      ...line,
      // ── Valores POR UNIDAD (el cálculo base) ──
      unitCostReal: round(unitCost),
      unitUtilidadBruta: round(unitUB),
      unitCostosFijos: round(unitCF),
      unitCostosFijosDesglose,
      unitUtilidadNeta: round(unitUN),
      unitComisionVendedor: round(unitComision),
      unitGananciaTienda: round(unitGanancia),
      unitInversionRecuperada: round(unitCost),
      // ── Valores TOTALES (unitario × cantidad) ──
      costReal: round(lineCost),
      utilidadBruta: round(ubLine),
      costosFijos: round(cfLine),
      costosFijosDesglose,
      costosFijosPct: dynamicPct,
      utilidadNeta: round(unLine),
      comisionVendedor: round(comisionLine),
      comisionPercent: comisionPct,
      gananciaTienda: round(gananciaLine),
      inversionRecuperada: round(lineCost),
    });
  }

  const comisionPercentGlobal = utilidadNetaTotal > 0 ? round((comisionVendedorTotal / utilidadNetaTotal) * 100) : 0;
  const costosFijosPctGlobal = utilidadBrutaTotal > 0 ? round((costosFijosTotal / utilidadBrutaTotal) * 100) : 0;

  return {
    saleTotal: round(saleTotal),
    costReal: round(costRealTotal),
    utilidadBruta: round(utilidadBrutaTotal),
    costosFijos: round(costosFijosTotal),
    utilidadNeta: round(utilidadNetaTotal),
    comisionVendedor: round(comisionVendedorTotal),
    comisionPercent: comisionPercentGlobal,
    gananciaTienda: round(gananciaTiendaTotal),
    costosFijosPct: costosFijosPctGlobal,
    inversionRecuperada: round(costRealTotal),
    linesFinancials,
  };
}

function round(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Comisión M1 — % escalonado según la UTILIDAD de la línea (venta − costo), no
// según saleTotal. Replica la tabla del Excel viejo:
//   ≤0 → 0 · ≤300 → 45% · ≤600 → 40% · ≤900 → 38% · ≤1000 → 35%
//   ≤1400 → 32% · ≤1800 → 30% · >1800 → 28%
// (El Excel dejaba 1800–2000 en "-"; aquí se rellena con 28% para no pagar 0.)
function migratedComisionPct(utilidad) {
  if (utilidad <= 0) return 0;
  if (utilidad <= 300) return 45;
  if (utilidad <= 600) return 40;
  if (utilidad <= 900) return 38;
  if (utilidad <= 1000) return 35;
  if (utilidad <= 1400) return 32;
  if (utilidad <= 1800) return 30;
  return 28;
}

// Financieros de venta MIGRADA, por línea con su modo.
//   - M1: utilidad = venta − costo, SIN costos fijos; comisión por tabla escalonada.
//   - M2: Utilidad Bruta = venta - costo. Gastos fijos = 15% de UB. Neta = UB - GF. Comisión sobre Neta.
// `lines`: [{ lineTotal, lineCost, mode }]. Devuelve la misma forma que computeFinancials.
function migratedM2ComisionPct(utilidadNeta) {
  if (utilidadNeta <= 0) return 0;
  if (utilidadNeta <= 300) return 45;
  if (utilidadNeta <= 600) return 40;
  if (utilidadNeta <= 900) return 38;
  if (utilidadNeta <= 1000) return 35;
  if (utilidadNeta <= 1400) return 32;
  if (utilidadNeta <= 1800) return 30;
  return 28;
}

function computeMigratedFinancials({ lines }) {
  let costReal = 0, utilidadBruta = 0, utilidadNeta = 0, comisionVendedor = 0, gananciaTienda = 0, totalCostosFijos = 0;
  const linesFinancials = [];

  for (const l of lines) {
    const qty = l.quantity || 1;
    const ub = (l.lineTotal || 0) - (l.lineCost || 0);
    const unitUB = qty > 0 ? ub / qty : 0;
    
    let neta = 0, comision = 0, gastosFijos = 0;
    let unitCF = 0, unitUN = 0, unitComision = 0;
    
    if (l.mode === 'M2') {
      unitCF = unitUB * 0.15; // 15% de Gastos Fijos
      unitUN = unitUB - unitCF;
      unitComision = unitUN > 0 ? unitUN * (migratedM2ComisionPct(unitUN) / 100) : 0;
      
      gastosFijos = unitCF * qty;
      neta = unitUN * qty;
      comision = unitComision * qty;
    } else {
      unitUN = unitUB; // sin costos fijos
      unitComision = unitUN > 0 ? unitUN * (migratedComisionPct(unitUN) / 100) : 0;
      
      neta = unitUN * qty;
      comision = unitComision * qty;
    }

    costReal += l.lineCost || 0;
    utilidadBruta += ub;
    totalCostosFijos += gastosFijos;
    utilidadNeta += neta;
    comisionVendedor += comision;
    const gananciaLine = neta - comision;
    gananciaTienda += gananciaLine;

    const unitCost = qty > 0 ? (l.lineCost || 0) / qty : 0;
    const unitGanancia = unitUN - unitComision;
    const cfPct = l.mode === 'M2' ? 15 : 0;
    const comPct = l.mode === 'M2' ? migratedM2ComisionPct(unitUN) : migratedComisionPct(unitUN);

    linesFinancials.push({
      ...l,
      // ── Valores POR UNIDAD ──
      unitCostReal: round(unitCost),
      unitUtilidadBruta: round(unitUB),
      unitCostosFijos: round(unitCF),
      unitUtilidadNeta: round(unitUN),
      unitComisionVendedor: round(unitComision),
      unitGananciaTienda: round(unitGanancia),
      unitInversionRecuperada: round(unitCost),
      // ── Valores TOTALES ──
      costReal: round(l.lineCost || 0),
      utilidadBruta: round(ub),
      costosFijos: round(gastosFijos),
      costosFijosPct: cfPct,
      utilidadNeta: round(neta),
      comisionVendedor: round(comision),
      comisionPercent: comPct,
      gananciaTienda: round(gananciaLine),
      inversionRecuperada: round(l.lineCost || 0),
    });
  }

  const comisionPercent = utilidadNeta > 0 ? round((comisionVendedor / utilidadNeta) * 100) : 0;
  const costosFijosPctGlobal = utilidadBruta > 0 ? round((totalCostosFijos / utilidadBruta) * 100) : 0;

  return {
    costReal: round(costReal),
    utilidadBruta: round(utilidadBruta),
    costosFijos: round(totalCostosFijos),
    utilidadNeta: round(utilidadNeta),
    comisionVendedor: round(comisionVendedor),
    comisionPercent,
    gananciaTienda: round(gananciaTienda),
    costosFijosPct: costosFijosPctGlobal,
    inversionRecuperada: round(costReal),
    linesFinancials,
  };
}

module.exports = { calcularComision, calcularComisionYPorcentaje, getCostosFijosPct, getCostosFijosConfig, computeFinancials, computeMigratedFinancials, round };

