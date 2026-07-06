// Facturación: tickets POS que RESERVAN stock FIFO al crearse.
// El ticket es la constancia de que el producto salió físicamente de la tienda:
// nace 'unlinked' (pendiente), el vendedor registra su venta DESDE él (→ 'linked')
// y hereda sus reservas; solo admin puede anularlo (→ 'void', libera reservas).
const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireCashier, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { nextTicketNumber, computeTotals } = require('../services/invoice');
const {
  reserveForItems,
  releaseReservation,
  reserveForMigratedItems,
  releaseMigratedReservation,
  migratedUnitCost,
} = require('../services/sales');
const { validatePriceFloor } = require('./sales/helpers');
const { invoiceBaseSchema } = require('../../shared/schemas.mjs');

const INVOICES = config.collections.invoices;
const PRODUCTS = config.collections.products;
const MIGRATED = config.collections.migratedInventory;
const ORDERS = config.collections.orders;
const USERS = config.collections.users;

const iso = (ts) => ts?.toDate?.()?.toISOString() || null;

// ── Búsqueda dual (nativo + migrado) ────────────────────────────────────────
// `origin` viaja con cada resultado para que el front y buildTicket sepan contra
// qué colección resolver el producto. El stock migrado se calcula igual que en
// reserveForMigratedItems (disponible = total − vendido − reservado).
const migratedAvailable = (m) =>
  Math.max(0, (m.quantity || 0) - (m.quantitySold || 0) - (m.quantityReserved || 0));

const mapNative = (id, p) => ({
  productId: id, code: p.code, name: p.name, price: p.price || 0, stock: p.stock || 0, origin: 'native',
});
const mapMigrated = (id, m) => ({
  productId: id, code: m.code, name: m.productName, price: m.price || 0, stock: migratedAvailable(m), origin: 'migrated',
});

// Combina PRODUCTS y MIGRATED (consultas en paralelo) y filtra en memoria por
// código o nombre (escala de la tienda). Devuelve ya normalizado y rankeado.
async function searchAllProducts(q) {
  const [nativeSnap, migratedSnap] = await Promise.all([
    db.collection(PRODUCTS).limit(500).get(),
    db.collection(MIGRATED).limit(500).get(),
  ]);
  const all = [
    ...nativeSnap.docs.map((d) => mapNative(d.id, d.data())),
    ...migratedSnap.docs.map((d) => mapMigrated(d.id, d.data())),
  ];
  const match = (p) => String(p.code || '').toLowerCase().includes(q)
    || String(p.name || '').toLowerCase().includes(q);
  const rank = (p) => (String(p.code || '').toLowerCase().startsWith(q) ? 0
    : String(p.name || '').toLowerCase().startsWith(q) ? 1 : 2);
  return all
    .filter(match)
    .sort((a, b) => rank(a) - rank(b) || String(a.name || '').localeCompare(String(b.name || '')))
    .slice(0, 8);
}

// Busca un código en nativo primero (compat) y luego en migrado. null si no está.
async function lookupAnyProduct(code) {
  const nat = await db.collection(PRODUCTS).where('code', '==', code).limit(1).get();
  if (!nat.empty) return mapNative(nat.docs[0].id, nat.docs[0].data());
  const mig = await db.collection(MIGRATED).where('code', '==', code).limit(1).get();
  if (!mig.empty) return mapMigrated(mig.docs[0].id, mig.docs[0].data());
  return null;
}

// Reserva / libera stock según el origen del ticket, sin duplicar la elección en
// cada endpoint (crear, editar, anular, eliminar).
const reserveByOrigin = (origin, lines) => (origin === 'migrated'
  ? reserveForMigratedItems(lines.map((l) => ({ migratedId: l.migratedId, quantity: l.quantity })))
  : reserveForItems(lines.map((l) => ({ code: l.productCode, quantity: l.quantity }))));

const releaseByOrigin = (origin, reservations) => (origin === 'migrated'
  ? releaseMigratedReservation(reservations)
  : releaseReservation(reservations));

function serializeInvoice(id, inv) {
  return {
    id,
    ...inv,
    createdAt: iso(inv.createdAt),
    updatedAt: iso(inv.updatedAt),
    linkedAt: iso(inv.linkedAt),
    voidInfo: inv.voidInfo ? { ...inv.voidInfo, at: iso(inv.voidInfo.at) } : null,
  };
}

// Valida el body, resuelve productos reales y calcula totales. Lanza con
// mensaje de usuario si algo no cuadra. Retorna { parsed, lines, subtotal, discount, total }.
async function buildTicket(body) {
  const parsed = invoiceBaseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message || 'Datos del ticket inválidos.');
  }

  // Resolver cada ítem contra la colección que corresponde a su origen. El migrado
  // se resuelve por doc id (sus códigos no garantizan unicidad); el nativo por
  // código, como siempre. El precio viene del body porque es negociable.
  const resolved = [];
  let hasNative = false;
  let hasMigrated = false;
  for (const it of parsed.data.items) {
    if (it.origin === 'migrated') {
      const snap = it.productId
        ? await db.collection(MIGRATED).doc(it.productId).get()
        : (await db.collection(MIGRATED).where('code', '==', it.productCode).limit(1).get()).docs[0];
      if (!snap || !snap.exists) throw new Error(`Producto migrado no encontrado: ${it.productCode}`);
      const m = snap.data();
      hasMigrated = true;
      resolved.push({
        productId: snap.id,
        migratedId: snap.id,
        origin: 'migrated',
        productCode: m.code,
        productName: m.productName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        unitCostReal: migratedUnitCost(m),
      });
    } else {
      const snap = await db.collection(PRODUCTS).where('code', '==', it.productCode).limit(1).get();
      if (snap.empty) throw new Error(`Producto no encontrado: ${it.productCode}`);
      const p = snap.docs[0].data();
      hasNative = true;
      resolved.push({
        productId: snap.docs[0].id,
        origin: 'native',
        productCode: p.code,
        productName: p.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      });
    }
  }

  // Regla de No-Mezcla (misma que el módulo de ventas): un ticket es 100% nativo
  // o 100% migrado, nunca ambos (sus reservas viven en colecciones distintas).
  if (hasNative && hasMigrated) {
    throw new Error('Un ticket no puede mezclar inventario actual y migrado. Emite tickets por separado.');
  }
  const saleOrigin = hasMigrated ? 'migrated' : 'native';

  const totals = computeTotals(resolved, parsed.data.discount);
  // computeTotals normaliza los campos "públicos"; reatamos los metadatos de
  // origen por índice para que la venta pueda reconstruir la línea migrada.
  const lines = totals.lines.map((l, i) => (resolved[i].origin === 'migrated'
    ? { ...l, origin: 'migrated', migratedId: resolved[i].migratedId, unitCostReal: resolved[i].unitCostReal }
    : { ...l, origin: 'native' }));

  // Piso de precio: nativo usa FIFO (costo + margen mínimo); el migrado ya conoce
  // su costo real, así que basta con no vender por debajo de él.
  if (saleOrigin === 'native') {
    await validatePriceFloor(lines.map((l) => ({ code: l.productCode, quantity: l.quantity, salePrice: l.unitPrice })));
  } else {
    for (const l of lines) {
      if (l.unitPrice < l.unitCostReal) {
        throw new Error(`El precio de "${l.productName}" (C$${Math.round(l.unitPrice)}) no puede estar por debajo de su costo real migrado (C$${Math.round(l.unitCostReal)}).`);
      }
    }
  }

  return { data: parsed.data, saleOrigin, lines, subtotal: totals.subtotal, discount: totals.discount, total: totals.total };
}

// GET /api/invoices — lista (cajero/admin). Filtro opcional ?status=unlinked|linked|void
router.get('/', requireCashier, asyncHandler(async (req, res) => {
  const snap = await db.collection(INVOICES).get();
  let list = snap.docs.map((d) => serializeInvoice(d.id, d.data()));
  if (req.query.status) list = list.filter((i) => i.status === req.query.status);
  list.sort((a, b) => String(b.ticketNumber || '').localeCompare(String(a.ticketNumber || '')));
  res.json(list);
}));

// GET /api/invoices/lookup?code= — busca un producto (nativo o migrado) por código.
router.get('/lookup', requireCashier, asyncHandler(async (req, res) => {
  const code = String(req.query.code || '').trim();
  if (!code) return res.status(400).json({ error: 'Código requerido.' });
  const found = await lookupAnyProduct(code);
  if (!found) return res.status(404).json({ error: 'Producto no encontrado.' });
  res.json(found);
}));

// GET /api/invoices/search?q= — sugerencias por código O nombre, combinando
// inventario nativo (PRODUCTS) y migrado (MIGRATED_INVENTORY). Cada resultado
// trae su bandera `origin`.
router.get('/search', requireCashier, asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q.length < 2) return res.json([]);
  res.json(await searchAllProducts(q));
}));

// GET /api/invoices/sellers — lista mínima de vendedores para asignar el ticket.
// Existe porque GET /api/users es solo-admin y la cajera necesita el selector;
// se expone únicamente { uid, email, name } (nada más del perfil).
router.get('/sellers', requireCashier, asyncHandler(async (req, res) => {
  const snap = await db.collection(USERS).get();
  const sellers = snap.docs
    .map((d) => ({ docId: d.id, ...d.data() }))
    .filter((u) => Array.isArray(u.roles)
      && u.roles.some((r) => ['seller', 'admin', 'global_admin', 'cashier'].includes(r)))
    .map((u) => ({ uid: u.uid || u.docId, email: u.email, name: u.displayName || u.email.split('@')[0] }))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json(sellers);
}));

// POST /api/invoices — genera un ticket pendiente y RESERVA su stock FIFO.
router.post('/', requireCashier, asyncHandler(async (req, res) => {
  let ticket;
  try {
    ticket = await buildTicket(req.body);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Reservar stock (transacción todo-o-nada; falla si no hay disponible).
  // Nativo → FIFO sobre purchases; migrado → sobre el lote de migrated_inventory.
  let reservations;
  try {
    reservations = await reserveByOrigin(ticket.saleOrigin, ticket.lines);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    const ticketNumber = await nextTicketNumber();
    const invoice = {
      ticketNumber,
      status: 'unlinked',
      saleOrigin: ticket.saleOrigin,
      customer: ticket.data.customer,
      contactId: ticket.data.contactId,
      items: ticket.lines,
      subtotal: ticket.subtotal,
      discount: ticket.discount,
      total: ticket.total, // sin delivery: el delivery es informativo, no entra a comisiones
      deliveryFee: ticket.data.deliveryFee,
      paymentMethod: ticket.data.paymentMethod,
      assignedSeller: ticket.data.assignedSeller,
      createdBy: {
        uid: req.user.uid,
        email: req.user.email,
        name: req.user.name || req.user.email.split('@')[0],
      },
      sellerName: ticket.data.assignedSeller.name, // compat con la lista vieja
      reservations,
      linkedOrderIds: [],
      linkedToOrder: null,
      voidInfo: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: null,
      linkedAt: null,
    };
    const ref = await db.collection(INVOICES).add(invoice);
    res.status(201).json(serializeInvoice(ref.id, { ...invoice, createdAt: null }));
  } catch (err) {
    // Si el ticket no se pudo persistir, no dejar stock secuestrado.
    await releaseByOrigin(ticket.saleOrigin, reservations).catch(() => {});
    throw err;
  }
}));

// PUT /api/invoices/:id — edita un ticket PENDIENTE (cajero) y reajusta reservas.
// Patrón liberar→reservar→restaurar (mismo trade-off aceptado en sales/manage.js).
router.put('/:id', requireCashier, asyncHandler(async (req, res) => {
  const ref = db.collection(INVOICES).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Ticket no encontrado.' });
  const inv = snap.data();
  if (inv.status !== 'unlinked') {
    return res.status(400).json({ error: 'Solo se editan tickets pendientes (sin venta registrada).' });
  }

  let ticket;
  try {
    ticket = await buildTicket(req.body);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const prevOrigin = inv.saleOrigin || 'native';
  const oldReservations = inv.reservations || [];
  await releaseByOrigin(prevOrigin, oldReservations);

  let reservations;
  try {
    reservations = await reserveByOrigin(ticket.saleOrigin, ticket.lines);
  } catch (err) {
    // Restaurar las reservas viejas (mejor esfuerzo, con SU propio origen) para
    // no perder el respaldo si la nueva reserva falla.
    await reserveByOrigin(prevOrigin, inv.items || []).catch(() => {});
    return res.status(400).json({ error: err.message });
  }

  await ref.update({
    saleOrigin: ticket.saleOrigin,
    customer: ticket.data.customer,
    contactId: ticket.data.contactId,
    items: ticket.lines,
    subtotal: ticket.subtotal,
    discount: ticket.discount,
    total: ticket.total,
    deliveryFee: ticket.data.deliveryFee,
    paymentMethod: ticket.data.paymentMethod,
    assignedSeller: ticket.data.assignedSeller,
    sellerName: ticket.data.assignedSeller.name,
    reservations,
    updatedAt: FieldValue.serverTimestamp(),
  });
  res.json({ ok: true });
}));

// POST /api/invoices/:id/void — anula un ticket pendiente (solo admin, con motivo).
// Libera las reservas: el stock vuelve a estar disponible.
router.post('/:id/void', requireAdmin, asyncHandler(async (req, res) => {
  const reason = String(req.body.reason || '').trim();
  if (!reason) return res.status(400).json({ error: 'El motivo de anulación es obligatorio.' });

  const ref = db.collection(INVOICES).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Ticket no encontrado.' });
  const inv = snap.data();
  if (inv.status !== 'unlinked') {
    return res.status(400).json({ error: 'Solo se anulan tickets pendientes.' });
  }

  await releaseByOrigin(inv.saleOrigin || 'native', inv.reservations || []);
  await ref.update({
    status: 'void',
    voidInfo: { reason, at: FieldValue.serverTimestamp(), by: req.user.email },
  });

  await db.collection(config.collections.auditLogs).add({
    action: 'invoice_voided',
    invoiceId: req.params.id,
    ticketNumber: inv.ticketNumber || null,
    reason,
    by: req.user.email,
    total: inv.total || 0,
    assignedSellerEmail: inv.assignedSeller?.email || null,
    at: FieldValue.serverTimestamp(),
  }).catch(() => {});

  res.json({ ok: true });
}));

// POST /api/invoices/:id/link — puente manual para tickets pre-reforma (admin).
// Endurecido: un ticket ya vinculado o anulado no se puede volver a usar.
router.post('/:id/link', requireAdmin, asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: 'Falta la venta a vincular.' });

  const invRef = db.collection(INVOICES).doc(req.params.id);
  const invSnap = await invRef.get();
  if (!invSnap.exists) return res.status(404).json({ error: 'Ticket no encontrado.' });
  if (invSnap.data().status !== 'unlinked') {
    return res.status(400).json({ error: 'Este ticket ya fue usado o está anulado.' });
  }

  const orderRef = db.collection(ORDERS).doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return res.status(404).json({ error: 'Venta no encontrada.' });

  await Promise.all([
    invRef.update({
      linkedToOrder: orderId,
      linkedOrderIds: [orderId],
      status: 'linked',
      linkedAt: FieldValue.serverTimestamp(),
    }),
    orderRef.update({ invoiceId: req.params.id }),
  ]);
  res.json({ ok: true });
}));

// DELETE /api/invoices/:id — elimina permanentemente un ticket (solo admin).
// NO permite borrar tickets vinculados a una venta (status 'linked') porque
// eso dejaría la venta huérfana. Pendientes y anulados sí se eliminan.
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(INVOICES).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Ticket no encontrado.' });
  const inv = snap.data();

  if (inv.status === 'linked') {
    return res.status(400).json({
      error: 'No se puede eliminar un ticket vinculado a una venta. Primero elimine la venta asociada.',
    });
  }

  // Si todavía está pendiente, liberar las reservas de stock (según su origen).
  if (inv.status === 'unlinked' && inv.reservations?.length) {
    await releaseByOrigin(inv.saleOrigin || 'native', inv.reservations).catch(() => {});
  }

  await ref.delete();

  // Auditoría
  await db.collection(config.collections.auditLogs).add({
    action: 'invoice_deleted',
    invoiceId: req.params.id,
    ticketNumber: inv.ticketNumber || null,
    previousStatus: inv.status,
    by: req.user.email,
    total: inv.total || 0,
    at: FieldValue.serverTimestamp(),
  }).catch(() => {});

  res.json({ ok: true });
}));

module.exports = router;
