// Lógica de inventario para ventas: costo real vía FIFO (lote más antiguo primero).
// Se usa en dos modos:
//   - consume=false → estimación para el cotizador (no toca la BD)
//   - consume=true  → al aprobar: descuenta qtySold del lote y stock del producto
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { RATE, STATUS } = require('./inventory');

const PURCHASES = config.collections.purchases;
const PRODUCTS = config.collections.products;
const MIGRATED = config.collections.migratedInventory;

// Calcula el costo real (C$) de vender `quantity` unidades del producto `code`.
// Recorre los lotes recibidos del más antiguo al más nuevo (FIFO).
// consume=false → estimación (no toca BD). consume=true → descuenta quantitySold.
async function fifoForCode(code, quantity, consume) {
  const snap = await db
    .collection(PURCHASES)
    .where('code', '==', code)
    .where('status', '==', STATUS.RECEIVED)
    .get();

  const lots = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.purchaseDate || '').localeCompare(String(b.purchaseDate || '')));

  let totalAvailable = 0;
  for (const lot of lots) {
    const reserved = lot.quantityReserved || 0;
    const available = Math.max(0, (lot.quantity || 0) - (lot.quantitySold || 0) - reserved);
    totalAvailable += available;
  }

  if (totalAvailable < quantity) {
    throw new Error(`Stock insuficiente para "${code}". Solicitado: ${quantity}, Disponible: ${totalAvailable}`);
  }

  let remaining = quantity;
  let realCost = 0;
  const writes = [];

  for (const lot of lots) {
    if (remaining <= 0) break;
    const reserved = lot.quantityReserved || 0;
    const available = Math.max(0, (lot.quantity || 0) - (lot.quantitySold || 0) - reserved);
    if (available <= 0) continue;
    const take = Math.min(remaining, available);
    const unitFinalUsd = (lot.priceUnit || 0) + (lot.shippingUnit || 0);
    realCost += unitFinalUsd * RATE * take;
    remaining -= take;
    if (consume) {
      writes.push(db.collection(PURCHASES).doc(lot.id).update({ quantitySold: FieldValue.increment(take) }));
    }
  }

  if (consume) {
    const prodSnap = await db.collection(PRODUCTS).where('code', '==', code).limit(1).get();
    if (!prodSnap.empty) {
      writes.push(prodSnap.docs[0].ref.update({ stock: FieldValue.increment(-quantity) }));
    }
    await Promise.all(writes);
  }

  return realCost;
}

// Reserva stock FIFO para los ítems de una venta recién registrada.
// Devuelve un array de { lotId, code, quantity, unitFinalUsd } para guardar en la orden.
async function reserveForItems(items) {
  const reservations = [];

  for (const it of items) {
    const { code, quantity } = it;
    const snap = await db
      .collection(PURCHASES)
      .where('code', '==', code)
      .where('status', '==', STATUS.RECEIVED)
      .get();

    const lots = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(a.purchaseDate || '').localeCompare(String(b.purchaseDate || '')));

    let totalAvailable = 0;
    for (const lot of lots) {
      const reserved = lot.quantityReserved || 0;
      totalAvailable += Math.max(0, (lot.quantity || 0) - (lot.quantitySold || 0) - reserved);
    }
    if (totalAvailable < quantity) {
      throw new Error(`Stock insuficiente para "${code}". Disponible: ${totalAvailable}, Solicitado: ${quantity}`);
    }

    let remaining = quantity;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const reserved = lot.quantityReserved || 0;
      const available = Math.max(0, (lot.quantity || 0) - (lot.quantitySold || 0) - reserved);
      if (available <= 0) continue;
      const take = Math.min(remaining, available);
      const unitFinalUsd = (lot.priceUnit || 0) + (lot.shippingUnit || 0);
      await db.collection(PURCHASES).doc(lot.id).update({ quantityReserved: FieldValue.increment(take) });
      reservations.push({ lotId: lot.id, code, quantity: take, unitFinalUsd });
      remaining -= take;
    }
  }

  return reservations;
}

// Libera las reservas de una venta rechazada.
async function releaseReservation(reservations) {
  const writes = reservations.map((r) =>
    db.collection(PURCHASES).doc(r.lotId).update({ quantityReserved: FieldValue.increment(-r.quantity) })
  );
  await Promise.all(writes);
}

// Al aprobar: convierte reservas en vendido (sin re-correr FIFO).
// Devuelve el costo real total (C$) calculado desde los lotes ya reservados.
async function consumeReservation(reservations) {
  let realCost = 0;
  const writes = [];

  for (const r of reservations) {
    realCost += r.unitFinalUsd * RATE * r.quantity;
    writes.push(
      db.collection(PURCHASES).doc(r.lotId).update({
        quantityReserved: FieldValue.increment(-r.quantity),
        quantitySold: FieldValue.increment(r.quantity),
      })
    );
  }

  // Agrupar por código para descontar stock del producto físico
  const byCode = {};
  for (const r of reservations) {
    byCode[r.code] = (byCode[r.code] || 0) + r.quantity;
  }
  for (const [code, qty] of Object.entries(byCode)) {
    const prodSnap = await db.collection(PRODUCTS).where('code', '==', code).limit(1).get();
    if (!prodSnap.empty) {
      writes.push(prodSnap.docs[0].ref.update({ stock: FieldValue.increment(-qty) }));
    }
  }

  await Promise.all(writes);
  return realCost;
}

// Costo real total de una lista de ítems [{ code, quantity }] (sin reserva ni consumo).
async function realCostForItems(items, consume) {
  let total = 0;
  for (const it of items) {
    total += await fifoForCode(it.code, it.quantity, consume);
  }
  return total;
}

// ───────────────────────────────────────────────────────────────────────────
// INVENTARIO MIGRADO — sus lotes viven en migrated_inventory (no en purchases),
// y su costo real ya está dado: (precioBase + envío) × RATE. No corre FIFO.
// ───────────────────────────────────────────────────────────────────────────

// Costo real unitario (C$) de un ítem migrado.
function migratedUnitCost(m) {
  return ((Number(m.costUnit) || 0) + (Number(m.shippingUnit) || 0)) * RATE;
}

// Reserva stock de ítems migrados [{ migratedId, quantity }].
// Devuelve [{ migratedId, code, quantity, unitCostReal }].
async function reserveForMigratedItems(items) {
  const reservations = [];
  for (const it of items) {
    const ref = db.collection(MIGRATED).doc(it.migratedId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Ítem migrado no encontrado.');
    const m = snap.data();
    const available = Math.max(0, (m.quantity || 0) - (m.quantitySold || 0) - (m.quantityReserved || 0));
    if (available < it.quantity) {
      throw new Error(`Stock migrado insuficiente para "${m.code}". Disponible: ${available}, Solicitado: ${it.quantity}`);
    }
    await ref.update({ quantityReserved: FieldValue.increment(it.quantity) });
    reservations.push({ migratedId: it.migratedId, code: m.code, quantity: it.quantity, unitCostReal: migratedUnitCost(m) });
  }
  return reservations;
}

// Libera reservas migradas (venta rechazada).
async function releaseMigratedReservation(reservations) {
  await Promise.all((reservations || []).map((r) =>
    db.collection(MIGRATED).doc(r.migratedId).update({ quantityReserved: FieldValue.increment(-r.quantity) })
  ));
}

// Convierte reservas migradas en vendido (suma a quantitySold → mueve "Salidas").
// Devuelve el costo real total (C$).
async function consumeMigratedReservation(reservations) {
  let realCost = 0;
  const writes = [];
  for (const r of reservations || []) {
    writes.push(db.collection(MIGRATED).doc(r.migratedId).update({
      quantityReserved: FieldValue.increment(-r.quantity),
      quantitySold: FieldValue.increment(r.quantity),
    }));
    realCost += (Number(r.unitCostReal) || 0) * r.quantity;
  }
  await Promise.all(writes);
  return realCost;
}

// ───────────────────────────────────────────────────────────────────────────
// DEVOLVER STOCK al eliminar una venta YA APROBADA/PAGADA (revierte el consumo).
// ───────────────────────────────────────────────────────────────────────────

// Nativo: regresa unidades a los lotes (quantitySold↓) y al stock del producto (↑).
async function restockApprovedNative(reservations) {
  const writes = [];
  const byCode = {};
  for (const r of reservations || []) {
    if (r.lotId) writes.push(db.collection(PURCHASES).doc(r.lotId).update({ quantitySold: FieldValue.increment(-r.quantity) }));
    byCode[r.code] = (byCode[r.code] || 0) + r.quantity;
  }
  for (const [code, qty] of Object.entries(byCode)) {
    const prodSnap = await db.collection(PRODUCTS).where('code', '==', code).limit(1).get();
    if (!prodSnap.empty) writes.push(prodSnap.docs[0].ref.update({ stock: FieldValue.increment(qty) }));
  }
  await Promise.all(writes);
}

// Migrado: regresa unidades al lote migrado (quantitySold↓ → baja "Salidas").
async function restockApprovedMigrated(reservations) {
  await Promise.all((reservations || []).map((r) =>
    db.collection(MIGRATED).doc(r.migratedId).update({ quantitySold: FieldValue.increment(-r.quantity) })
  ));
}

module.exports = {
  fifoForCode,
  realCostForItems,
  reserveForItems,
  releaseReservation,
  consumeReservation,
  migratedUnitCost,
  reserveForMigratedItems,
  releaseMigratedReservation,
  consumeMigratedReservation,
  restockApprovedNative,
  restockApprovedMigrated,
};

