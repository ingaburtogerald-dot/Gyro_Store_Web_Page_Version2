// Helpers compartidos por las rutas de ventas (server/routes/sales/*).
// El cotizador y la aprobación comparten la misma fórmula (services/commission)
// y el mismo FIFO (services/sales). Los totales y la comisión SIEMPRE se
// calculan en el servidor.
const { db } = require('../../firebase');
const config = require('../../config');
const { computeMigratedFinancials } = require('../../services/commission');
const { fifoForCode, releaseReservation, releaseMigratedReservation } = require('../../services/sales');
const { RATE } = require('../../services/inventory');
const { imageUpload } = require('../../utils/upload');
const logger = require('../../utils/logger');

const ORDERS = config.collections.orders;
const PRODUCTS = config.collections.products;
const MIGRATED = config.collections.migratedInventory;
const upload = imageUpload({ maxSizeMb: 8 });

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

// Distribuye las reservas ya tomadas entre los grupos de líneas (una venta por
// código+precio): para cada código, asigna reservas a los grupos en orden hasta
// cubrir la cantidad de cada grupo, partiendo una reserva si hace falta.
// Retorna Map(groupIndex → reservations[]).
function distributeReservations(lineGroups, reservations) {
  const reservationsByCode = new Map();
  for (const r of reservations || []) {
    const arr = reservationsByCode.get(r.code) || [];
    arr.push(r);
    reservationsByCode.set(r.code, arr);
  }

  const reservationsForGroup = new Map(); // groupIndex → reservations[]
  const codeReservationCursors = new Map(); // code → { idx, offset } cursor en el array de reservas
  for (let gi = 0; gi < lineGroups.length; gi++) {
    const groupLines = lineGroups[gi];
    const code = groupLines[0].code;
    const groupQty = groupLines.reduce((s, l) => s + l.quantity, 0);
    const codeRes = reservationsByCode.get(code) || [];
    if (!codeReservationCursors.has(code)) codeReservationCursors.set(code, { idx: 0, offset: 0 });
    const cursor = codeReservationCursors.get(code);
    const assigned = [];
    let remaining = groupQty;
    while (remaining > 0 && cursor.idx < codeRes.length) {
      const r = codeRes[cursor.idx];
      const available = r.quantity - cursor.offset;
      if (available <= remaining) {
        // Tomar el resto de esta reserva.
        if (cursor.offset > 0) {
          assigned.push({ ...r, quantity: available });
        } else {
          assigned.push({ ...r });
        }
        remaining -= available;
        cursor.idx++;
        cursor.offset = 0;
      } else {
        // Partir: tomar solo una parte de esta reserva.
        assigned.push({ ...r, quantity: remaining });
        cursor.offset += remaining;
        remaining = 0;
      }
    }
    reservationsForGroup.set(gi, assigned);
  }
  return reservationsForGroup;
}

// Libera reservas según el origen de la venta. Un fallo aquí deja stock
// reservado sin venta que lo respalde, así que se registra (no se traga).
async function releaseAny(saleOrigin, reservations) {
  if (!reservations || reservations.length === 0) return;
  const release = saleOrigin === 'migrated' ? releaseMigratedReservation : releaseReservation;
  await release(reservations).catch((err) =>
    logger.error('stock_release_failed', { origin: saleOrigin, message: err.message }));
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
  distributeReservations,
  releaseAny,
};
