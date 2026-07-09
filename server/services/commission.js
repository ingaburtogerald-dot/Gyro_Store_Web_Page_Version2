// LÃ³gica de negocio de ventas: comisiones y rentabilidad. CENTRALIZADA aquÃ­ para
// que el cotizador (estimaciÃ³n) y la aprobaciÃ³n (definitivo) usen exactamente la
// misma fÃ³rmula. NO duplicar estas cuentas en ninguna otra parte.
const { db } = require('../firebase');
const config = require('../config');

// Paso 5 â€” ComisiÃ³n del vendedor: Tasa plana inteligente dinÃ¡mica segÃºn saleTotal
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
    // Para facturas mayores a 7000 cÃ³rdobas, mantenemos por ahora el mismo margen del rango anterior (12% FC y 25% comisiÃ³n)
    return { costosFijosPct: 12, comisionPct: 25 };
  }
}

// Paso 5 â€” ComisiÃ³n del vendedor: Tasa plana inteligente dinÃ¡mica segÃºn saleTotal
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
// Si se pasa, cada lÃ­nea incluirÃ¡ el desglose por categoría.
function computeFinancials({ lines }) {
  let costRealTotal = 0, utilidadBrutaTotal = 0, utilidadNetaTotal = 0, comisionVendedorTotal = 0, gananciaTiendaTotal = 0, costosFijosTotal = 0, saleTotal = 0;
  const linesFinancials = [];

  const breakdownWeights = { prestamos: 5, garantias: 5, publicidad: 10, servicios: 5, insumos: 5 };
  const totalWeight = 30; // 5 + 5 + 10 + 5 + 5

  for (const line of lines) {
    const unitPrice = line.salePrice || 0;
    const qty = line.quantity || 1;
    const lineTotal = unitPrice * qty;
    const lineCost = line.lineCost || 0;
    const unitCost = qty > 0 ? lineCost / qty : 0;
    
    // MÃ¡rgenes basados en PRECIO UNITARIO (solo para la comisiÃ³n ahora)
    const { comisionPct } = getDynamicMargins(unitPrice);
    
    const unitUB = unitPrice - unitCost;
    // Nuevo cÃ¡lculo de costos fijos: ya estÃ¡n agregados al costo real (25% del costoFijoCordobas = unitCost / 0.75 - unitCost)
    const unitCF = (unitCost / 0.75) - unitCost;
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

    // Desglose de costos fijos
    const unitCostosFijosDesglose = {};
    const costosFijosDesglose = {};
    for (const [k, w] of Object.entries(breakdownWeights)) {
      unitCostosFijosDesglose[k] = round(unitCF * (w / totalWeight));
      costosFijosDesglose[k] = round(unitCF * (w / totalWeight) * qty);
    }

    const unitGanancia = unitUN - unitComision;

    linesFinancials.push({
      ...line,
      // â”€â”€ Valores POR UNIDAD (el cÃ¡lculo base) â”€â”€
      unitCostReal: round(unitCost),
      unitUtilidadBruta: round(unitUB),
      unitCostosFijos: round(unitCF),
      unitCostosFijosDesglose,
      unitUtilidadNeta: round(unitUN),
      unitComisionVendedor: round(unitComision),
      unitGananciaTienda: round(unitGanancia),
      unitInversionRecuperada: round(unitCost),
      // â”€â”€ Valores TOTALES (unitario Ã— cantidad) â”€â”€
      costReal: round(lineCost),
      utilidadBruta: round(ubLine),
      costosFijos: round(cfLine),
      costosFijosDesglose,
      costosFijosPct: 25, // Conceptualmente representa el 25% del costo con fijos
      utilidadNeta: round(unLine),
      comisionVendedor: round(comisionLine),
      comisionPercent: comisionPct,
      gananciaTienda: round(gananciaLine),
      inversionRecuperada: round(lineCost),
    });
  }

  const comisionPercentGlobal = utilidadNetaTotal > 0 ? round((comisionVendedorTotal / utilidadNetaTotal) * 100) : 0;
  const costosFijosPctGlobal = 25;

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

// ComisiÃ³n M1 â€” % escalonado segÃºn la UTILIDAD de la lÃ­nea (venta âˆ’ costo), no
// segÃºn saleTotal. Replica la tabla del Excel viejo:
//   â‰¤0 â†’ 0 Â· â‰¤300 â†’ 45% Â· â‰¤600 â†’ 40% Â· â‰¤900 â†’ 38% Â· â‰¤1000 â†’ 35%
//   â‰¤1400 â†’ 32% Â· â‰¤1800 â†’ 30% Â· >1800 â†’ 28%
// (El Excel dejaba 1800â€“2000 en "-"; aquÃ­ se rellena con 28% para no pagar 0.)
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

// Financieros de venta MIGRADA, por lÃ­nea con su modo.
//   - M1: utilidad = venta âˆ’ costo, SIN costos fijos; comisiÃ³n por tabla escalonada.
//   - M2: Utilidad Bruta = venta - costo. Gastos fijos = (unitCost / 0.75) - unitCost. Neta = UB - GF. ComisiÃ³n sobre Neta.
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

  const breakdownWeights = { prestamos: 5, garantias: 5, publicidad: 10, servicios: 5, insumos: 5 };
  const totalWeight = 30; // 5 + 5 + 10 + 5 + 5

  for (const l of lines) {
    const qty = l.quantity || 1;
    const ub = (l.lineTotal || 0) - (l.lineCost || 0);
    const unitUB = qty > 0 ? ub / qty : 0;
    const unitCost = qty > 0 ? (l.lineCost || 0) / qty : 0;
    
    let neta = 0, comision = 0, gastosFijos = 0;
    let unitCF = 0, unitUN = 0, unitComision = 0;
    
    let unitCostosFijosDesglose = null;
    let costosFijosDesglose = null;

    // "para ventas mihradas sera el mismo proceso"
    // Asumimos que ahora todas las migradas aplican el mismo costo fijo del 25%?
    // El usuario dijo: "para ventas mihradas sera el mismo proceso". AsÃ­ que M2 y M1 ahora usan el mismo cÃ¡lculo de costo fijo.
    // Wait, M1 era SIN costos fijos antes. Si el usuario dijo "para ventas mihradas sera el mismo proceso", 
    // asumirÃ© que ahora aplica para todos.
    
    unitCF = (unitCost / 0.75) - unitCost;
    unitUN = unitUB - unitCF;
    
    unitCostosFijosDesglose = {};
    costosFijosDesglose = {};
    for (const [k, w] of Object.entries(breakdownWeights)) {
      unitCostosFijosDesglose[k] = round(unitCF * (w / totalWeight));
      costosFijosDesglose[k] = round(unitCF * (w / totalWeight) * qty);
    }

    if (l.mode === 'M2') {
      unitComision = unitUN > 0 ? unitUN * (migratedM2ComisionPct(unitUN) / 100) : 0;
    } else {
      // M1 original calculaba comisiÃ³n sobre Utilidad Bruta. Lo mantendrÃ© usando la escala en UB para no romper el % del vendedor migrado, 
      // a menos que tambiÃ©n cambie a utilidades netas. El usuario dijo "el mismo proceso".
      // UsarÃ© la misma lÃ³gica: comisiÃ³n sobre Utilidad Neta.
      unitComision = unitUN > 0 ? unitUN * (migratedComisionPct(unitUN) / 100) : 0;
    }
    
    gastosFijos = unitCF * qty;
    neta = unitUN * qty;
    comision = unitComision * qty;

    costReal += l.lineCost || 0;
    utilidadBruta += ub;
    totalCostosFijos += gastosFijos;
    utilidadNeta += neta;
    comisionVendedor += comision;
    const gananciaLine = neta - comision;
    gananciaTienda += gananciaLine;

    const unitGanancia = unitUN - unitComision;
    const cfPct = 25;
    const comPct = l.mode === 'M2' ? migratedM2ComisionPct(unitUN) : migratedComisionPct(unitUN);

    linesFinancials.push({
      ...l,
      // â”€â”€ Valores POR UNIDAD â”€â”€
      unitCostReal: round(unitCost),
      unitUtilidadBruta: round(unitUB),
      unitCostosFijos: round(unitCF),
      unitCostosFijosDesglose,
      unitUtilidadNeta: round(unitUN),
      unitComisionVendedor: round(unitComision),
      unitGananciaTienda: round(unitGanancia),
      unitInversionRecuperada: round(unitCost),
      // â”€â”€ Valores TOTALES â”€â”€
      costReal: round(l.lineCost || 0),
      utilidadBruta: round(ub),
      costosFijos: round(gastosFijos),
      costosFijosDesglose,
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

