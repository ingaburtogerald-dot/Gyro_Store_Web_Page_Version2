// Control de inventario — UN solo flujo: purchases (registro) → products (bodega).
// Estados: china (en tránsito) → pending (pendiente aprobación) → received (recibido).
const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireSeller, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { purchaseSchema, migratedItemSchema, arrivalSchema } = require('../utils/validators');
const inv = require('../services/inventory');

const PURCHASES = config.collections.purchases;
const PRODUCTS = config.collections.products;
const MIGRATED = config.collections.migratedInventory;

function badRequest(res, parsed) {
  return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Datos inválidos.' });
}

// Traduce ?period=YYYY-MM a un rango [start, end) sobre purchaseDate (string ISO).
// Devuelve null para "all", vacío o formato inválido (= sin filtro de fecha).
// Es un rango sobre UN solo campo → no requiere índice compuesto en Firestore.
function periodRange(period) {
  const m = /^(\d{4})-(\d{2})$/.exec(period || '');
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]); // 1-12
  if (month < 1 || month > 12) return null;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    start: `${m[1]}-${m[2]}-01`,
    end: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
  };
}

// Aplica el filtro de periodo (si lo hay) a una consulta de la colección dada.
function purchasesQuery(collection, period) {
  const range = periodRange(period);
  let q = db.collection(collection);
  if (range) q = q.where('purchaseDate', '>=', range.start).where('purchaseDate', '<', range.end);
  return q;
}

// GET /api/inventory/available — items con status 'received' y stock > 0 (seller, admin).
router.get('/available', requireSeller, asyncHandler(async (req, res) => {
  const snap = await db.collection(PURCHASES).where('status', '==', inv.STATUS.RECEIVED).get();
  const isAdminLike = (u) => u.roles.includes('admin') || u.roles.includes('global_admin');
  const isUserAdmin = isAdminLike(req.user);

  const rows = snap.docs
    .map((d) => {
      const p = d.data();
      const row = inv.computeInventoryRow({ id: d.id, ...p });
      
      if (!isUserAdmin) {
        // Remove cost details for sellers
        delete row.priceUnitUsd;
        delete row.shippingUnitUsd;
        delete row.priceUnitFinalUsd;
        delete row.costRealCordobas;
        delete row.preTotalUsd;
        delete row.totalFinalUsd;
        delete row.lot;
      }
      return row;
    })
    .filter((r) => r.available > 0);

  res.json(rows);
}));

// GET /api/inventory/incoming — items con status 'china' o 'pending' (seller, admin).
router.get('/incoming', requireSeller, asyncHandler(async (req, res) => {
  const snapChina = await db.collection(PURCHASES).where('status', '==', inv.STATUS.CHINA).get();
  const snapPending = await db.collection(PURCHASES).where('status', '==', 'pending').get();
  
  const docs = [...snapChina.docs, ...snapPending.docs];
  const isAdminLike = (u) => u.roles.includes('admin') || u.roles.includes('global_admin');
  const isUserAdmin = isAdminLike(req.user);

  const list = docs.map((d) => {
    const p = d.data();
    if (!isUserAdmin) {
      // Return a stripped view for sellers
      return {
        id: d.id,
        productName: p.productName,
        code: p.code,
        quantity: p.quantity,
        status: p.status,
        purchaseDate: p.purchaseDate || null,
      };
    }
    return { id: d.id, ...p };
  });

  list.sort((a, b) => String(b.purchaseDate || '').localeCompare(String(a.purchaseDate || '')));

  res.json(list);
}));


// GET /api/inventory/purchases — todas las compras (ordenadas). ?period=YYYY-MM filtra por mes.
router.get('/purchases', requireAdmin, asyncHandler(async (req, res) => {
  const snap = await purchasesQuery(PURCHASES, req.query.period).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => {
    const byDate = String(b.purchaseDate || '').localeCompare(String(a.purchaseDate || ''));
    if (byDate) return byDate;
    return String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true });
  });
  res.json(list);
}));

// POST /api/inventory/purchases — registra una compra (status china).
router.post('/purchases', requireAdmin, asyncHandler(async (req, res) => {
  const parsed = purchaseSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed);
  const data = parsed.data;

  const existing = await db.collection(PURCHASES).where('code', '==', data.code).limit(1).get();
  if (!existing.empty) {
    return res.status(400).json({ error: `El código "${data.code}" ya existe en el inventario.` });
  }

  const calc = inv.computePurchase(data);
  const doc = {
    lot: data.lot,
    code: data.code,
    productName: data.productName,
    category: null,
    purchaseDate: data.purchaseDate,
    arrivalDate: null,
    ...calc,
    quantitySold: 0,
    quantityReserved: 0,
    suggestedPrice: data.suggestedPrice != null ? Number(data.suggestedPrice) : null,
    status: inv.STATUS.CHINA,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection(PURCHASES).add(doc);
  res.status(201).json({ id: ref.id, ...doc });
}));

// ───────────────────────────────────────────────────────────────────────────
// INVENTARIO MIGRADO — ítems históricos cargados a mano desde el Excel viejo.
// Vive en una colección APARTE (migrated_inventory): el inventario actual no se
// toca. Cada documento lleva origin:'migrated' como bandera para el badge.
// Las reglas de venta de estos lotes se definirán después.
// ───────────────────────────────────────────────────────────────────────────

// GET /api/inventory/migrated — lista del inventario migrado (admin). ?period=YYYY-MM filtra por mes.
router.get('/migrated', requireAdmin, asyncHandler(async (req, res) => {
  const snap = await purchasesQuery(MIGRATED, req.query.period).get();
  const list = snap.docs.map((d) => inv.computeMigratedRow(d.id, d.data()));
  list.sort((a, b) => String(b.purchaseDate || '').localeCompare(String(a.purchaseDate || '')));
  res.json(list);
}));

// POST /api/inventory/migrated — registra un ítem migrado (admin).
router.post('/migrated', requireAdmin, asyncHandler(async (req, res) => {
  const parsed = migratedItemSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed);
  const data = parsed.data;

  const doc = {
    origin: 'migrated', // 🏷️ bandera: ítem migrado del sistema viejo
    status: inv.STATUS.RECEIVED, // ya está en bodega (aislado en su propia colección)
    lot: data.lot,
    code: data.code,
    productName: data.productName,
    purchaseDate: data.purchaseDate,
    quantity: data.quantity, // compradas
    quantitySold: 0, // salidas: lo moverán las ventas del lote migrado
    quantityReserved: 0,
    costUnit: data.costUnit, // precio base USD
    shippingUnit: data.shippingUnit, // costo de envío unitario USD
    comments: data.comments,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection(MIGRATED).add(doc);
  res.status(201).json(inv.computeMigratedRow(ref.id, doc));
}));

// PUT /api/inventory/migrated/:id — edita un ítem migrado (admin). Preserva las
// salidas/reservas; no permite bajar las compradas por debajo de lo comprometido.
router.put('/migrated/:id', requireAdmin, asyncHandler(async (req, res) => {
  const parsed = migratedItemSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed);
  const data = parsed.data;

  const ref = db.collection(MIGRATED).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Ítem migrado no encontrado.' });
  const m = snap.data();

  const committed = (m.quantitySold || 0) + (m.quantityReserved || 0);
  if (data.quantity < committed) {
    return res.status(400).json({ error: `No puedes bajar las compradas a ${data.quantity}: ya hay ${committed} entre vendidas/reservadas.` });
  }

  const update = {
    lot: data.lot,
    code: data.code,
    productName: data.productName,
    purchaseDate: data.purchaseDate,
    quantity: data.quantity,
    costUnit: data.costUnit,
    shippingUnit: data.shippingUnit,
    comments: data.comments,
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.update(update);
  res.json(inv.computeMigratedRow(req.params.id, { ...m, ...update }));
}));

// DELETE /api/inventory/migrated/:id — elimina un ítem migrado (admin).
router.delete('/migrated/:id', requireAdmin, asyncHandler(async (req, res) => {
  await db.collection(MIGRATED).doc(req.params.id).delete();
  res.json({ ok: true });
}));

// PATCH /api/inventory/purchases/:id/arrival — reportar llegada → pending.
// PATCH /api/inventory/purchases/:id/arrival — reportar llegada → received + alta en bodega.
router.patch('/purchases/:id/arrival', requireAdmin, asyncHandler(async (req, res) => {
  const parsed = arrivalSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed);
  const { arrivalDate, shippingUnit, category, suggestedPrice } = parsed.data;

  const ref = db.collection(PURCHASES).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Compra no encontrada.' });
  const p = snap.data();
  if (p.status !== inv.STATUS.CHINA) {
    return res.status(400).json({ error: 'Solo se puede reportar llegada de compras en tránsito.' });
  }

  // Upsert en products (bodega): se busca por código.
  const prodQuery = await db.collection(PRODUCTS).where('code', '==', p.code).limit(1).get();
  if (prodQuery.empty) {
    await db.collection(PRODUCTS).add({
      code: p.code,
      name: p.productName,
      category: category || null,
      stock: p.quantity,
      price: suggestedPrice != null ? Number(suggestedPrice) : inv.suggestedPriceCordobas((p.priceUnit || 0) + shippingUnit),
      images: [],
      specs: [],
      featured: false,
      deletedAt: null,
      order: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await prodQuery.docs[0].ref.update({
      stock: FieldValue.increment(p.quantity),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  const arrivalUpdate = {
    arrivalDate,
    shippingUnit,
    category,
    status: inv.STATUS.RECEIVED,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (suggestedPrice != null) arrivalUpdate.suggestedPrice = Number(suggestedPrice);
  await ref.update(arrivalUpdate);
  res.json({ ok: true, id: req.params.id });
}));

// PUT /api/inventory/purchases/:id — editar datos base (recalcula derivados y actualiza bodega si es recibido).
router.put('/purchases/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(PURCHASES).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Compra no encontrada.' });

  const current = snap.data();
  const merged = { ...current, ...req.body };
  const calc = inv.computePurchase(merged);

  // Si ya fue recibido, sincronizar el cambio con la colección de PRODUCTS (bodega)
  if (current.status === inv.STATUS.RECEIVED) {
    const diffQty = calc.quantity - (current.quantity || 0);

    // El precio de venta del producto SOLO se cambia cuando la edición trae un
    // suggestedPrice explícito (p.ej. desde el modal de recepción). Editar otros
    // datos de la compra (nombre, cantidad, costo…) NO debe pisar el precio: si el
    // admin lo ajustó a mano, se respeta. Antes se reescribía siempre y "cambiaba solo".
    const priceProvided =
      req.body.suggestedPrice !== undefined &&
      req.body.suggestedPrice !== null &&
      req.body.suggestedPrice !== '';
    const explicitPrice = priceProvided ? Number(req.body.suggestedPrice) : null;
    // Precio inicial solo para productos que haya que CREAR aquí (necesitan un valor).
    const newPrice = explicitPrice != null
      ? explicitPrice
      : (merged.suggestedPrice != null
          ? Number(merged.suggestedPrice)
          : inv.suggestedPriceCordobas(calc.priceUnit + (calc.shippingUnit || 0)));

    // Si cambió el código del producto, mover el stock de un producto a otro
    if (merged.code !== current.code) {
      // 1. Restar el stock viejo del producto anterior
      const oldProdQuery = await db.collection(PRODUCTS).where('code', '==', current.code).limit(1).get();
      if (!oldProdQuery.empty) {
        await oldProdQuery.docs[0].ref.update({
          stock: FieldValue.increment(-(current.quantity || 0)),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // 2. Sumar / Crear el stock nuevo en el nuevo producto
      const newProdQuery = await db.collection(PRODUCTS).where('code', '==', merged.code).limit(1).get();
      if (newProdQuery.empty) {
        await db.collection(PRODUCTS).add({
          code: merged.code,
          name: merged.productName,
          category: merged.category || null,
          stock: calc.quantity,
          price: newPrice,
          images: [],
          specs: [],
          featured: false,
          deletedAt: null,
          order: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        const upd = {
          name: merged.productName,
          category: merged.category || null,
          stock: FieldValue.increment(calc.quantity),
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (explicitPrice != null) upd.price = explicitPrice;
        await newProdQuery.docs[0].ref.update(upd);
      }
    } else {
      // Si el código es el mismo, actualizamos stock relativo, nombre y categoría.
      // El precio solo si vino explícito (ver comentario arriba).
      const prodQuery = await db.collection(PRODUCTS).where('code', '==', current.code).limit(1).get();
      if (!prodQuery.empty) {
        const upd = {
          name: merged.productName,
          category: merged.category || null,
          stock: FieldValue.increment(diffQty),
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (explicitPrice != null) upd.price = explicitPrice;
        await prodQuery.docs[0].ref.update(upd);
      } else {
        // Por si acaso no existía el producto (consistencia), lo agregamos
        await db.collection(PRODUCTS).add({
          code: merged.code,
          name: merged.productName,
          category: merged.category || null,
          stock: calc.quantity,
          price: newPrice,
          images: [],
          specs: [],
          featured: false,
          deletedAt: null,
          order: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
  }

  await ref.update({
    lot: merged.lot,
    code: merged.code,
    productName: merged.productName,
    purchaseDate: merged.purchaseDate,
    arrivalDate: merged.arrivalDate || null,
    category: merged.category || null,
    suggestedPrice: merged.suggestedPrice != null ? Number(merged.suggestedPrice) : (current.suggestedPrice || null),
    ...calc,
    updatedAt: FieldValue.serverTimestamp(),
  });
  res.json({ ok: true, id: req.params.id });
}));

// PATCH /api/inventory/purchases/:id/revert — revierte estado recibido → en tránsito (resta stock).
router.patch('/purchases/:id/revert', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(PURCHASES).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Compra no encontrada.' });
  const p = snap.data();
  if (p.status !== inv.STATUS.RECEIVED) {
    return res.status(400).json({ error: 'Solo se puede revertir una compra recibida.' });
  }

  // Restar el stock correspondiente de la bodega de productos
  const prodQuery = await db.collection(PRODUCTS).where('code', '==', p.code).limit(1).get();
  if (!prodQuery.empty) {
    await prodQuery.docs[0].ref.update({
      stock: FieldValue.increment(-p.quantity),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  // Regresar la compra a estado CHINA (en tránsito) y limpiar campos de llegada
  await ref.update({
    arrivalDate: null,
    shippingUnit: 0,
    category: null,
    status: inv.STATUS.CHINA,
    updatedAt: FieldValue.serverTimestamp(),
  });

  res.json({ ok: true, id: req.params.id });
}));

// DELETE /api/inventory/purchases/:id — solo si sigue en tránsito.
router.delete('/purchases/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(PURCHASES).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Compra no encontrada.' });
  if (snap.data().status !== inv.STATUS.CHINA) {
    return res.status(400).json({ error: 'No se puede eliminar una compra que ya llegó o fue recibida.' });
  }
  await ref.delete();
  res.json({ ok: true, id: req.params.id });
}));

// GET /api/inventory/current — inventario recibido en bodega (columnas calculadas).
// ?period=YYYY-MM filtra por mes. Con periodo, el rango va a la query (un campo) y
// el status 'received' se filtra en memoria para no exigir un índice compuesto.
router.get('/current', requireAdmin, asyncHandler(async (req, res) => {
  const range = periodRange(req.query.period);
  const q = range
    ? db.collection(PURCHASES).where('purchaseDate', '>=', range.start).where('purchaseDate', '<', range.end)
    : db.collection(PURCHASES).where('status', '==', inv.STATUS.RECEIVED);
  const snap = await q.get();
  const rows = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.status === inv.STATUS.RECEIVED)
    .map((p) => inv.computeInventoryRow(p))
    .filter((r) => r.available > 0);
  res.json(rows);
}));

// GET /api/inventory/kpis — KPIs del dashboard de inventario. ?period=YYYY-MM filtra por mes.
router.get('/kpis', requireAdmin, asyncHandler(async (req, res) => {
  const snap = await purchasesQuery(PURCHASES, req.query.period).get();
  res.json(inv.computeKpis(snap.docs.map((d) => d.data())));
}));

module.exports = router;
