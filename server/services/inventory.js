// Lógica de cálculo del inventario, centralizada (DRY). Las rutas no repiten
// fórmulas: todas pasan por aquí. Reciclado/ordenado del proyecto anterior.
const config = require('../config');

const RATE = config.exchangeRate; // USD → C$ fijo (37)

// Estados del flujo: comprado/en tránsito → pendiente de aprobación → recibido.
const STATUS = { CHINA: 'china', PENDING: 'pending', RECEIVED: 'received' };

// Calcula los campos derivados de una compra (registro China).
function computePurchase(p) {
  const quantity = Math.max(1, parseInt(p.quantity, 10) || 1);
  const costUnit = Math.max(0, parseFloat(p.costUnit) || 0); // precio base USD
  const taxUnit = Math.max(0, parseFloat(p.taxUnit) || 0); // impuesto unitario USD
  const shippingUnit = Math.max(0, parseFloat(p.shippingUnit) || 0); // envío unitario USD

  const priceUnit = costUnit + taxUnit; // precio unitario (sin envío)
  const total = quantity * priceUnit;

  return { quantity, costUnit, taxUnit, shippingUnit, priceUnit, total };
}

// Calcula las columnas de la vista "Inventario Actual" para una compra recibida.
function computeInventoryRow(p) {
  const quantitySold = Math.max(0, parseInt(p.quantitySold, 10) || 0);
  const quantityReserved = Math.max(0, parseInt(p.quantityReserved, 10) || 0);
  const available = Math.max(0, (p.quantity || 0) - quantitySold - quantityReserved);
  const priceUnit = p.priceUnit || 0;
  const shippingUnit = p.shippingUnit || 0;
  const priceUnitFinal = priceUnit + shippingUnit;

  return {
    id: p.id,
    code: p.code,
    productName: p.productName,
    category: p.category || null,
    lot: p.lot,
    quantityOriginal: p.quantity || 0,
    quantitySold,
    quantityReserved,
    available,
    priceUnitUsd: priceUnit,
    shippingUnitUsd: shippingUnit,
    priceUnitFinalUsd: priceUnitFinal,
    costRealCordobas: priceUnitFinal * RATE,
    preTotalUsd: priceUnit * available,
    totalFinalUsd: priceUnitFinal * available,
    suggestedPrice: p.suggestedPrice || suggestedPriceCordobas(priceUnitFinal),
  };
}

// Agrega los KPIs del dashboard de inventario a partir de todas las compras.
function computeKpis(purchases) {
  const kpis = {
    totalPurchases: purchases.length,
    inTransit: 0,
    received: 0,
    subtotalInvertidoUsd: 0, // base × cantidad (sin impuesto)
    totalImpuestosUsd: 0,
    totalInversionConImpuestosUsd: 0,
    totalEnviosUsd: 0,
  };

  for (const p of purchases) {
    if (p.status === STATUS.CHINA) kpis.inTransit++;
    else if (p.status === STATUS.RECEIVED) kpis.received++;

    const qty = p.quantity || 0;
    kpis.subtotalInvertidoUsd += (p.costUnit || 0) * qty;
    kpis.totalImpuestosUsd += (p.taxUnit || 0) * qty;
    kpis.totalEnviosUsd += (p.shippingUnit || 0) * qty;
  }
  kpis.totalInversionConImpuestosUsd = kpis.subtotalInvertidoUsd + kpis.totalImpuestosUsd;
  return kpis;
}

// Precio de venta sugerido (C$) al recibir en bodega, basado en margen progresivo
// J2 / (1 - margin) redondeado a la decena más cercana.
function suggestedPriceCordobas(priceUnitFinal) {
  const costReal = priceUnitFinal * RATE;
  let margin = 0.35;
  if (costReal < 100) margin = 0.75;
  else if (costReal <= 300) margin = 0.55;
  else if (costReal <= 500) margin = 0.50;
  else if (costReal <= 800) margin = 0.45;
  else if (costReal <= 1200) margin = 0.40;

  const suggested = costReal / (1 - margin);
  return Math.round(suggested / 10) * 10;
}

// Calcula las columnas de la vista "Inventario Migrado" para un ítem histórico.
// Precios base/envío en USD; coste real y sugerido en C$. El precio sugerido
// es "ganarle 40% del coste real" (coste × 1.40), redondeado a la decena.
function computeMigratedRow(id, m) {
  const quantity = Math.max(0, parseInt(m.quantity, 10) || 0); // compradas
  const quantitySold = Math.max(0, parseInt(m.quantitySold, 10) || 0); // salidas (ventas)
  const quantityReserved = Math.max(0, parseInt(m.quantityReserved, 10) || 0);
  const stock = Math.max(0, quantity - quantitySold - quantityReserved);

  const priceBaseUsd = Math.max(0, parseFloat(m.costUnit) || 0);
  const shippingUnitUsd = Math.max(0, parseFloat(m.shippingUnit) || 0);
  const priceUnitFinalUsd = priceBaseUsd + shippingUnitUsd;
  const preTotalUsd = priceBaseUsd * stock;
  const totalUsd = priceUnitFinalUsd * stock;
  const costRealUnitCordobas = priceUnitFinalUsd * RATE;
  const suggestedPrice = Math.round((costRealUnitCordobas * 1.40) / 10) * 10;

  return {
    id,
    ...m,
    quantity,
    quantitySold,
    quantityReserved,
    stock,
    priceBaseUsd,
    shippingUnitUsd,
    priceUnitFinalUsd,
    preTotalUsd,
    totalUsd,
    costRealUnitCordobas,
    suggestedPrice,
  };
}

module.exports = { STATUS, RATE, computePurchase, computeInventoryRow, computeMigratedRow, computeKpis, suggestedPriceCordobas };
