// Helpers compartidos por las rutas de ventas (server/routes/sales/*).
// El cotizador y la aprobación comparten la misma fórmula (services/commission)
// y el mismo FIFO (services/sales). Los totales y la comisión SIEMPRE se
// calculan en el servidor.
const multer = require('multer');
const { db } = require('../../firebase');
const config = require('../../config');
const { computeMigratedFinancials } = require('../../services/commission');
const { fifoForCode, releaseReservation, releaseMigratedReservation } = require('../../services/sales');
const { RATE } = require('../../services/inventory');

const ORDERS = config.collections.orders;
const PRODUCTS = config.collections.products;
const MIGRATED = config.collections.migratedInventory;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const isAdminLike = (u) => u.roles.includes('admin') || u.roles.includes('global_admin');

// Quita campos de costo/utilidad confidenciales de las líneas antes de responder a
// un no-admin (el vendedor nunca debe ver costo real ni utilidades de la tienda).
function publicItems(items) {
  return (items || []).map((it) => {
    const { unitCostReal, costReal, utilidadBruta, costosFijos, utilidadNeta, ...rest } = it;
    return rest;
  });
}

function getISOWeekString(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const weekPad = String(weekNo).padStart(2, '0');
  return `${d.getUTCFullYear()}-W${weekPad}`;
}

// Resuelve cada ítem contra products (nativo) o migrated_inventory (migrado).
// Devuelve líneas confiables + saleTotal + saleOrigin. Una venta NO puede mezclar
// inventario actual y migrado (regla de negocio).
async function buildLines(items) {
  // Los lookups a Firestore van en paralelo (antes: un await por ítem); el
  // procesamiento posterior es secuencial para conservar orden y errores.
  const docs = await Promise.all(
    (items || []).map((it) => {
      const productId = String(it.productId || '');
      if (!productId) return null;
      const col = it.origin === 'migrated' ? MIGRATED : PRODUCTS;
      return db.collection(col).doc(productId).get();
    }),
  );

  const lines = [];
  let saleTotal = 0;
  let hasNative = false, hasMigrated = false;

  (items || []).forEach((it, i) => {
    const doc = docs[i];
    if (!doc || !doc.exists) return;
    const quantity = Math.max(1, parseInt(it.quantity, 10) || 1);
    const salePrice = Math.max(0, parseFloat(it.salePrice) || 0);

    if (it.origin === 'migrated') {
      const m = doc.data();
      const lineTotal = salePrice * quantity;
      const unitCostReal = ((Number(m.costUnit) || 0) + (Number(m.shippingUnit) || 0)) * RATE;
      if (salePrice < unitCostReal) {
        throw new Error(`El precio ingresado para el producto migrado "${m.productName}" (C$${salePrice}) no puede estar por debajo de su coste real (C$${Math.round(unitCostReal)}).`);
      }
      saleTotal += lineTotal;
      hasMigrated = true;
      lines.push({
        productId: doc.id,
        migratedId: doc.id,
        origin: 'migrated',
        mode: it.mode === 'M2' ? 'M2' : 'M1',
        code: m.code,
        name: m.productName,
        variantName: 'Migrado',
        quantity,
        salePrice,
        lineTotal,
        unitCostReal,
      });
    } else {
      const p = doc.data();
      const lineTotal = salePrice * quantity;
      saleTotal += lineTotal;
      hasNative = true;
      lines.push({
        productId: doc.id,
        origin: 'native',
        code: p.code,
        name: p.name,
        variantName: String(it.variantName || 'Estándar'),
        quantity,
        salePrice,
        lineTotal,
      });
    }
  });

  if (hasNative && hasMigrated) {
    throw new Error('Una venta no puede mezclar inventario actual y migrado. Regístralas por separado.');
  }
  return { lines, saleTotal, saleOrigin: hasMigrated ? 'migrated' : 'native' };
}

// Financieros estimados de una venta migrada a partir de sus líneas ya resueltas.
function migratedFinancialsFromLines(lines, saleTotal) {
  return computeMigratedFinancials({
    lines: lines.map((l) => ({
      ...l,
      lineTotal: l.salePrice * l.quantity,
      lineCost: (Number(l.unitCostReal) || 0) * l.quantity,
      mode: l.mode,
    })),
    saleTotal,
  });
}

async function validatePriceFloor(lines) {
  for (const line of lines) {
    const lineCost = await fifoForCode(line.code, line.quantity, false);
    const unitRealCost = lineCost / line.quantity;
    if (line.salePrice < unitRealCost * 1.15) {
      throw new Error("Ese monto no puede ingresarse porque está por debajo del coste real del producto y el margen mínimo permitido.");
    }
  }
}

// Libera reservas según el origen de la venta.
async function releaseAny(saleOrigin, reservations) {
  if (!reservations || reservations.length === 0) return;
  if (saleOrigin === 'migrated') await releaseMigratedReservation(reservations).catch(() => {});
  else await releaseReservation(reservations).catch(() => {});
}

module.exports = {
  ORDERS,
  PRODUCTS,
  MIGRATED,
  upload,
  isAdminLike,
  publicItems,
  getISOWeekString,
  buildLines,
  migratedFinancialsFromLines,
  validatePriceFloor,
  releaseAny,
};
