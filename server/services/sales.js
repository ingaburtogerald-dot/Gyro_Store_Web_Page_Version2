// Lógica de inventario para ventas: costo real vía FIFO (lote más antiguo primero).
// Se usa en dos modos:
//   - consume=false → estimación para el cotizador (no toca la BD)
//   - consume=true  → al aprobar: descuenta qtySold del lote y stock del producto
//
// Las operaciones que verifican disponibilidad y luego escriben (reservar/consumir)
// corren dentro de db.runTransaction: sin transacción, dos ventas concurrentes del
// mismo producto pueden pasar ambas la verificación de stock y sobrevender.
// Las operaciones de solo-incremento (liberar reserva, restock) no verifican nada,
// así que los increments atómicos les bastan y no necesitan transacción.
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { RATE, STATUS } = require('./inventory');

const PURCHASES = config.collections.purchases;
const PRODUCTS = config.collections.products;
const MIGRATED = config.collections.migratedInventory;

// Unidades libres de un lote, restando lo ya tomado en esta misma operación.
function lotAvailable(lot) {
  const reserved = lot.quantityReserved || 0;
  const taken = lot._taken || 0;
  return Math.max(0, (lot.quantity || 0) - (lot.quantitySold || 0) - reserved - taken);
}

// Lee los lotes recibidos de un código, ordenados FIFO (más antiguo primero).
// `tx` opcional: dentro de una transacción la lectura pasa por tx.get.
async function getLots(code, tx) {
  const query = db
    .collection(PURCHASES)
    .where('code', '==', code)
    .where('status', '==', STATUS.RECEIVED);
  const snap = tx ? await tx.get(query) : await query.get();
  return snap.docs
    .map((d) => ({ ...d.data(), id: d.id, ref: d.ref, _taken: 0 }))
    .sort((a, b) => String(a.purchaseDate || '').localeCompare(String(b.purchaseDate || '')));
}

// Recorre los lotes en orden FIFO tomando `quantity` unidades. Marca lo tomado en
// cada lote (`_taken`) y devuelve [{ lot, take }]. Lanza si no alcanza el stock.
function takeFifo(lots, code, quantity) {
  const totalAvailable = lots.reduce((s, lot) => s + lotAvailable(lot), 0);
  if (totalAvailable < quantity) {
    throw new Error(`Stock insuficiente para "${code}". Solicitado: ${quantity}, Disponible: ${totalAvailable}`);
  }
  const takes = [];
  let remaining = quantity;
  for (const lot of lots) {
    if (remaining <= 0) break;
    const available = lotAvailable(lot);
    if (available <= 0) continue;
    const take = Math.min(remaining, available);
    lot._taken = (lot._taken || 0) + take;
    takes.push({ lot, take });
    remaining -= take;
  }
  return takes;
}

// Calcula el costo real (C$) de vender `quantity` unidades del producto `code`.
// consume=false → estimación (solo lectura, sin transacción).
// consume=true  → transacción: verifica stock, descuenta quantitySold del lote
//                 y stock del producto de forma atómica.
async function fifoForCode(code, quantity, consume) {
  if (!consume) {
    const lots = await getLots(code);
    const takes = takeFifo(lots, code, quantity);
    return takes.reduce((s, { lot, take }) => s + ((lot.priceUnit || 0) + (lot.shippingUnit || 0)) * RATE * take, 0);
  }

  return db.runTransaction(async (tx) => {
    // Fase de lectura (en una transacción todas las lecturas van antes de escribir).
    const lots = await getLots(code, tx);
    const prodQuery = db.collection(PRODUCTS).where('code', '==', code).limit(1);
    const prodSnap = await tx.get(prodQuery);

    const takes = takeFifo(lots, code, quantity);

    let realCost = 0;
    for (const { lot, take } of takes) {
      realCost += ((lot.priceUnit || 0) + (lot.shippingUnit || 0)) * RATE * take;
      tx.update(lot.ref, { quantitySold: FieldValue.increment(take) });
    }
    if (!prodSnap.empty) {
      tx.update(prodSnap.docs[0].ref, { stock: FieldValue.increment(-quantity) });
    }
    return realCost;
  });
}

// Reserva stock FIFO para los ítems de una venta recién registrada — todo en UNA
// transacción: o se reservan todas las líneas o ninguna.
// Devuelve un array de { lotId, code, quantity, unitFinalUsd } para guardar en la orden.
async function reserveForItems(items) {
  return db.runTransaction(async (tx) => {
    // Fase de lectura: lotes de cada código (una sola vez por código).
    const lotsByCode = new Map();
    for (const it of items) {
      if (!lotsByCode.has(it.code)) lotsByCode.set(it.code, await getLots(it.code, tx));
    }

    // Fase de cálculo: `_taken` acumula lo tomado entre ítems del mismo código.
    const reservations = [];
    const incByLot = new Map(); // lotId → { ref, qty }
    for (const it of items) {
      const takes = takeFifo(lotsByCode.get(it.code), it.code, it.quantity);
      for (const { lot, take } of takes) {
        reservations.push({
          lotId: lot.id,
          code: it.code,
          quantity: take,
          unitFinalUsd: (lot.priceUnit || 0) + (lot.shippingUnit || 0),
        });
        const acc = incByLot.get(lot.id) || { ref: lot.ref, qty: 0 };
        acc.qty += take;
        incByLot.set(lot.id, acc);
      }
    }

    // Fase de escritura: un solo update por lote (los transforms no se acumulan
    // si se escriben dos veces sobre el mismo doc dentro de la transacción).
    for (const { ref, qty } of incByLot.values()) {
      tx.update(ref, { quantityReserved: FieldValue.increment(qty) });
    }
    return reservations;
  });
}

// Libera las reservas de una venta rechazada (increments atómicos, sin verificación).
async function releaseReservation(reservations) {
  const writes = reservations.map((r) =>
    db.collection(PURCHASES).doc(r.lotId).update({ quantityReserved: FieldValue.increment(-r.quantity) })
  );
  await Promise.all(writes);
}

// Al aprobar: convierte reservas en vendido (sin re-correr FIFO) de forma atómica.
// Devuelve el costo real total (C$) calculado desde los lotes ya reservados.
async function consumeReservation(reservations) {
  return db.runTransaction(async (tx) => {
    // Fase de lectura: producto físico por código (para descontar stock).
    const byCode = {};
    for (const r of reservations) {
      byCode[r.code] = (byCode[r.code] || 0) + r.quantity;
    }
    const prodRefs = [];
    for (const [code, qty] of Object.entries(byCode)) {
      const snap = await tx.get(db.collection(PRODUCTS).where('code', '==', code).limit(1));
      if (!snap.empty) prodRefs.push({ ref: snap.docs[0].ref, qty });
    }

    // Fase de escritura: agrupado por lote (una reserva puede repetir lote).
    let realCost = 0;
    const incByLot = new Map(); // lotId → qty
    for (const r of reservations) {
      realCost += r.unitFinalUsd * RATE * r.quantity;
      incByLot.set(r.lotId, (incByLot.get(r.lotId) || 0) + r.quantity);
    }
    for (const [lotId, qty] of incByLot) {
      tx.update(db.collection(PURCHASES).doc(lotId), {
        quantityReserved: FieldValue.increment(-qty),
        quantitySold: FieldValue.increment(qty),
      });
    }
    for (const { ref, qty } of prodRefs) {
      tx.update(ref, { stock: FieldValue.increment(-qty) });
    }
    return realCost;
  });
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

// Reserva stock de ítems migrados [{ migratedId, quantity }] en una transacción.
// Devuelve [{ migratedId, code, quantity, unitCostReal }].
async function reserveForMigratedItems(items) {
  return db.runTransaction(async (tx) => {
    // Fase de lectura: todos los docs migrados (un ítem puede repetirse en la lista).
    const qtyById = new Map();
    for (const it of items) {
      qtyById.set(it.migratedId, (qtyById.get(it.migratedId) || 0) + it.quantity);
    }
    const docs = new Map();
    for (const id of qtyById.keys()) {
      const snap = await tx.get(db.collection(MIGRATED).doc(id));
      if (!snap.exists) throw new Error('Ítem migrado no encontrado.');
      docs.set(id, snap);
    }

    // Verificación + escritura.
    const reservations = [];
    for (const [id, quantity] of qtyById) {
      const m = docs.get(id).data();
      const available = Math.max(0, (m.quantity || 0) - (m.quantitySold || 0) - (m.quantityReserved || 0));
      if (available < quantity) {
        throw new Error(`Stock migrado insuficiente para "${m.code}". Disponible: ${available}, Solicitado: ${quantity}`);
      }
      tx.update(docs.get(id).ref, { quantityReserved: FieldValue.increment(quantity) });
      reservations.push({ migratedId: id, code: m.code, quantity, unitCostReal: migratedUnitCost(m) });
    }
    return reservations;
  });
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
