// Agregación de reportes: KPIs del periodo + series para los gráficos.
// El periodo puede ser un mes específico o TODO el año (month == null).
// Incluye inversión de compras-China Y de inventario migrado (por su fecha de compra),
// y suma las ventas migradas (M1) junto con las actuales.
const config = require('../config');
const { RATE } = require('./inventory');

// ¿La fecha cae en el periodo? Si month es null/undefined → cualquier mes del año.
function inPeriod(dateStr, year, month) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime()) || d.getFullYear() !== year) return false;
  return month == null ? true : d.getMonth() === month;
}

function inMonth(dateStr, year, month) {
  return inPeriod(dateStr, year, month);
}

function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function lossToCordobas(loss) {
  const amount = Number(loss.amount) || 0;
  return (loss.currency || 'C$') === 'USD' ? amount * RATE : amount;
}

// Reparte las deducciones de un periodo a partir de los registros de `losses`:
//   - Pérdidas de inventario (kind !== 'expense', incluye docs legacy sin kind).
//   - Gastos (kind === 'expense') agrupados; cada grupo presupuestado tiene un "pozo"
//     = costosFijosReal × (%grupo / Σ%). Solo el excedente sobre el pozo reduce la
//     ganancia. Los grupos sin pozo ('varios') la reducen por completo.
// `costosFijosReal` es la reserva de costos fijos acumulada por las ventas del periodo.
// Categorías de pérdida de inventario que se cubren con el presupuesto de Garantías:
// consumen su pozo (como un gasto presupuestado) en vez de bajar la ganancia al 100%.
// Solo el excedente sobre el pozo reduce la ganancia. 'robo' NO entra (no es garantía).
const WARRANTY_CATEGORIES = new Set(['daño', 'devolucion', 'regalias']);

function computeDeductions(periodLosses, costosFijosReal) {
  const groups = config.expenseGroups;
  const sumPct = groups.reduce((s, g) => s + (g.budgeted ? Number(config.costosFijos[g.key]) || 0 : 0), 0) || 1;

  let perdidasInventario = 0;
  const spentByGroup = {};
  for (const l of periodLosses) {
    const amt = lossToCordobas(l);
    if (l.kind === 'expense') {
      const g = l.group || 'varios';
      spentByGroup[g] = (spentByGroup[g] || 0) + amt;
    } else if (WARRANTY_CATEGORIES.has(l.category)) {
      // Daño / Devolución / Regalías → salen del pozo de Garantías.
      spentByGroup.garantias = (spentByGroup.garantias || 0) + amt;
    } else {
      perdidasInventario += amt; // robo o legacy sin categoría
    }
  }

  // `excedente` = parte del gasto que efectivamente reduce la ganancia.
  const byGroup = groups.map((g) => {
    const spent = spentByGroup[g.key] || 0;
    if (g.budgeted) {
      const pool = costosFijosReal * ((Number(config.costosFijos[g.key]) || 0) / sumPct);
      return {
        group: g.key, label: g.label, budgeted: true,
        pool: Math.round(pool), spent: Math.round(spent),
        saldo: Math.round(pool - spent), excedente: Math.round(Math.max(0, spent - pool)),
      };
    }
    return {
      group: g.key, label: g.label, budgeted: false,
      pool: 0, spent: Math.round(spent), saldo: 0, excedente: Math.round(spent),
    };
  });

  const excedentes = byGroup.filter((b) => b.budgeted).reduce((s, b) => s + b.excedente, 0);
  const varios = byGroup.filter((b) => !b.budgeted).reduce((s, b) => s + b.excedente, 0);
  const total = perdidasInventario + excedentes + varios;
  return { perdidasInventario: Math.round(perdidasInventario), excedentes, varios, total: Math.round(total), byGroup };
}

function buildReport({ purchases, sales, migrated = [], losses, year, month }) {
  const approved = sales.filter((s) => s.status === 'approved' || s.status === 'paid');

  // ── Inversión del periodo: compras-China + inventario migrado (por fecha de compra) ──
  let inversionUsd = 0, impuestosUsd = 0, enviosUsd = 0;
  for (const p of purchases) {
    if (!inPeriod(p.purchaseDate, year, month)) continue;
    const qty = p.quantity || 0;
    inversionUsd += (p.priceUnit || 0) * qty;
    impuestosUsd += (p.taxUnit || 0) * qty;
    enviosUsd += (p.shippingUnit || 0) * qty;
  }
  for (const mi of migrated) {
    if (!inPeriod(mi.purchaseDate, year, month)) continue;
    const qty = mi.quantity || 0;
    inversionUsd += (Number(mi.costUnit) || 0) * qty;
    enviosUsd += (Number(mi.shippingUnit) || 0) * qty;
  }

  // ── Ventas del periodo (incluye migradas M1; sus costosFijos vienen en 0) ──
  let ventasCordobas = 0, comisionesCordobas = 0, gananciaTiendaSum = 0, totalCostoVenta = 0, costosFijosReal = 0;
  for (const s of approved) {
    if (!inPeriod(s.createdAt, year, month)) continue;
    ventasCordobas += s.saleTotal || 0;
    comisionesCordobas += s.comisionVendedor || 0;
    gananciaTiendaSum += s.gananciaTienda || 0;
    totalCostoVenta += s.costReal || 0;
    costosFijosReal += s.costosFijos || 0;
  }

  // Deducciones del periodo: pérdidas de inventario + excedentes de gasto + gastos varios.
  const periodLosses = losses.filter((l) => inPeriod(l.date, year, month));
  const ded = computeDeductions(periodLosses, costosFijosReal);
  const perdidasCordobas = ded.total; // total que reduce la ganancia (compat. con KPI existente)

  const gananciaNetaCordobas = gananciaTiendaSum - perdidasCordobas;
  // Margen = retorno sobre la inversión recuperada: por cada C$ de inventario que
  // recuperaste al vender, cuánto ganaste de verdad (ganancia neta / costo de venta).
  const margenPct = totalCostoVenta > 0 ? (gananciaNetaCordobas / totalCostoVenta) * 100 : 0;

  const kpis = {
    inversionUsd, inversionCordobas: inversionUsd * RATE,
    impuestosUsd, enviosUsd,
    ventasCordobas, comisionesCordobas,
    costosFijosCordobas: Math.round(costosFijosReal),
    gananciaTiendaCordobas: Math.round(gananciaTiendaSum),
    totalCostoVentaCordobas: Math.round(totalCostoVenta),
    perdidasCordobas, gananciaNetaCordobas,
    // Desglose de las deducciones para las tarjetas y la tabla de presupuesto.
    perdidasInventarioCordobas: ded.perdidasInventario,
    gastosExcedenteCordobas: ded.excedentes,
    gastosVariosCordobas: ded.varios,
    margenPct: Math.round(margenPct * 10) / 10,
  };

  // ── Tendencia: los 12 meses del año seleccionado (inversión, ventas, ganancia) ──
  const monthly = [];
  for (let m = 0; m < 12; m++) {
    const invUsd =
      purchases.filter((p) => inMonth(p.purchaseDate, year, m)).reduce((s, p) => s + (p.priceUnit || 0) * (p.quantity || 0), 0) +
      migrated.filter((mi) => inMonth(mi.purchaseDate, year, m)).reduce((s, mi) => s + (Number(mi.costUnit) || 0) * (mi.quantity || 0), 0);
    const periodSales = approved.filter((s) => inMonth(s.createdAt, year, m));
    const vts = periodSales.reduce((sum, s) => sum + (s.saleTotal || 0), 0);
    const gan = periodSales.reduce((sum, s) => sum + (s.gananciaTienda || 0), 0);
    const com = periodSales.reduce((sum, s) => sum + (s.comisionVendedor || 0), 0);
    const cfRealMonth = periodSales.reduce((sum, s) => sum + (s.costosFijos || 0), 0);
    const dedMonth = computeDeductions(losses.filter((l) => inMonth(l.date, year, m)), cfRealMonth);
    monthly.push({
      month: monthKey(year, m),
      inversion: Math.round(invUsd * RATE),
      ventas: Math.round(vts),
      ganancia: Math.round(gan),
      gananciaNeta: Math.round(gan - dedMonth.total),
      comisiones: Math.round(com),
    });
  }

  // ── Costos fijos: distribuye el costo fijo REAL del periodo por categoría ──
  // (las ventas migradas no retienen costos fijos → aportan 0).
  const cfEntries = Object.entries(config.costosFijos);
  const sumPct = cfEntries.reduce((s, [, v]) => s + (Number(v) || 0), 0) || 1;
  const costosFijos = cfEntries.map(([name, pct]) => ({
    name,
    value: Math.round(costosFijosReal * ((Number(pct) || 0) / sumPct)),
  }));

  // ── Performance por vendedor (incluye migradas, atribuidas a su vendedor) ──
  // Se agrupa por NOMBRE (normalizado), no por email: un mismo vendedor puede tener
  // ventas bajo dos correos distintos (p.ej. cuenta nueva + ventas migradas del Excel
  // viejo) y antes salía duplicado en el ranking.
  const perfMap = {};
  for (const s of approved) {
    if (!inPeriod(s.createdAt, year, month)) continue;
    const name = (s.sellerName || s.sellerEmail || '—').trim();
    const key = name.toLowerCase();
    if (!perfMap[key]) perfMap[key] = { sellerName: name, totalVendido: 0, comisiones: 0 };
    perfMap[key].totalVendido += s.saleTotal || 0;
    perfMap[key].comisiones += s.comisionVendedor || 0;
  }
  const performance = Object.values(perfMap)
    .map((p) => ({ ...p, comisiones: Math.round(p.comisiones) }))
    .sort((a, b) => b.totalVendido - a.totalVendido);

  return { range: { year, month: month == null ? null : month }, kpis, charts: { monthly, costosFijos, performance, presupuestoVsGasto: ded.byGroup } };
}

module.exports = { buildReport };
