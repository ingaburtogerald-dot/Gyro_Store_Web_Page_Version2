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

  const perdidasCordobas = losses
    .filter((l) => inPeriod(l.date, year, month))
    .reduce((sum, l) => sum + lossToCordobas(l), 0);

  const gananciaNetaCordobas = gananciaTiendaSum - perdidasCordobas;
  const margenPct = ventasCordobas > 0 ? (gananciaNetaCordobas / ventasCordobas) * 100 : 0;

  const kpis = {
    inversionUsd, inversionCordobas: inversionUsd * RATE,
    impuestosUsd, enviosUsd,
    ventasCordobas, comisionesCordobas,
    costosFijosCordobas: Math.round(costosFijosReal),
    gananciaTiendaCordobas: Math.round(gananciaTiendaSum),
    totalCostoVentaCordobas: Math.round(totalCostoVenta),
    perdidasCordobas, gananciaNetaCordobas,
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
    const perdMonth = losses.filter((l) => inMonth(l.date, year, m)).reduce((sum, l) => sum + lossToCordobas(l), 0);
    monthly.push({
      month: monthKey(year, m),
      inversion: Math.round(invUsd * RATE),
      ventas: Math.round(vts),
      ganancia: Math.round(gan),
      gananciaNeta: Math.round(gan - perdMonth),
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
  const perfMap = {};
  for (const s of approved) {
    if (!inPeriod(s.createdAt, year, month)) continue;
    if (!perfMap[s.sellerEmail]) perfMap[s.sellerEmail] = { sellerName: s.sellerName, totalVendido: 0, comisiones: 0 };
    perfMap[s.sellerEmail].totalVendido += s.saleTotal || 0;
    perfMap[s.sellerEmail].comisiones += s.comisionVendedor || 0;
  }
  const performance = Object.values(perfMap)
    .map((p) => ({ ...p, comisiones: Math.round(p.comisiones) }))
    .sort((a, b) => b.totalVendido - a.totalVendido);

  return { range: { year, month: month == null ? null : month }, kpis, charts: { monthly, costosFijos, performance } };
}

module.exports = { buildReport };
