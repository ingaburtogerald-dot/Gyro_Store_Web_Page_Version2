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

// Pasos 1-6: a partir del precio de venta total (C$) y el costo real (C$, vía FIFO),
// calcula utilidad bruta, costos fijos, utilidad neta, comisión y ganancia de la tienda.
function computeFinancials({ saleTotal, realCost, costosFijosPct }) {
  const { costosFijosPct: dynamicPct } = getDynamicMargins(saleTotal);
  const costoVenta = realCost; // Paso 1 (ya en C$)
  const utilidadBruta = saleTotal - costoVenta; // Paso 2
  const costosFijos = utilidadBruta * (dynamicPct / 100); // Paso 3 (ahora dinámico sobre la utilidad bruta)
  const utilidadNeta = utilidadBruta - costosFijos; // Paso 4
  const { amount: comisionVendedor, percent: comisionPercent } = calcularComisionYPorcentaje(utilidadNeta, saleTotal); // Paso 5
  const gananciaTienda = utilidadNeta - comisionVendedor; // Paso 6

  return {
    costReal: round(costoVenta),
    utilidadBruta: round(utilidadBruta),
    costosFijos: round(costosFijos),
    utilidadNeta: round(utilidadNeta),
    comisionVendedor: round(comisionVendedor),
    comisionPercent,
    gananciaTienda: round(gananciaTienda),
    costosFijosPct: dynamicPct,
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
//   - M2: pendiente de definir (se bloquea por ahora).
// `lines`: [{ lineTotal, lineCost, mode }]. Devuelve la misma forma que computeFinancials.
function computeMigratedFinancials({ lines }) {
  let costReal = 0, utilidadBruta = 0, utilidadNeta = 0, comisionVendedor = 0, gananciaTienda = 0;

  for (const l of lines) {
    if (l.mode === 'M2') throw new Error('Ventas M2 aún no está configurado.');
    const ub = (l.lineTotal || 0) - (l.lineCost || 0); // M1: utilidad = venta − costo
    const neta = ub; // sin costos fijos
    const comision = neta > 0 ? neta * (migratedComisionPct(neta) / 100) : 0;
    costReal += l.lineCost || 0;
    utilidadBruta += ub;
    utilidadNeta += neta;
    comisionVendedor += comision;
    gananciaTienda += neta - comision;
  }

  const comisionPercent = utilidadNeta > 0 ? round((comisionVendedor / utilidadNeta) * 100) : 0;
  return {
    costReal: round(costReal),
    utilidadBruta: round(utilidadBruta),
    costosFijos: 0,
    utilidadNeta: round(utilidadNeta),
    comisionVendedor: round(comisionVendedor),
    comisionPercent,
    gananciaTienda: round(gananciaTienda),
    costosFijosPct: 0,
  };
}

module.exports = { calcularComision, calcularComisionYPorcentaje, getCostosFijosPct, computeFinancials, computeMigratedFinancials, round };

