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
const { reserveForItems, releaseReservation } = require('../services/sales');
const { validatePriceFloor } = require('./sales/helpers');
const { invoiceBaseSchema } = require('../../shared/schemas.mjs');

const INVOICES = config.collections.invoices;
const PRODUCTS = config.collections.products;
const ORDERS = config.collections.orders;
const USERS = config.collections.users;

const iso = (ts) => ts?.toDate?.()?.toISOString() || null;

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

  // Resolver cada código contra el catálogo nativo (productId/nombre reales;
  // el precio viene del body porque es negociable).
  const resolved = [];
  for (const it of parsed.data.items) {
    const snap = await db.collection(PRODUCTS).where('code', '==', it.productCode).limit(1).get();
    if (snap.empty) throw new Error(`Producto no encontrado: ${it.productCode}`);
    const p = snap.docs[0].data();
    resolved.push({
      productId: snap.docs[0].id,
      productCode: p.code,
      productName: p.name,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
    });
  }

  const totals = computeTotals(resolved, parsed.data.discount);

  // Piso de precio: mismo criterio que las ventas (costo FIFO + margen mínimo).
  await validatePriceFloor(totals.lines.map((l) => ({
    code: l.productCode,
    quantity: l.quantity,
    salePrice: l.unitPrice,
  })));

  return { data: parsed.data, ...totals };
}

const toReserveInput = (lines) => lines.map((l) => ({ code: l.productCode, quantity: l.quantity }));

// GET /api/invoices — lista (cajero/admin). Filtro opcional ?status=unlinked|linked|void
router.get('/', requireCashier, asyncHandler(async (req, res) => {
  const snap = await db.collection(INVOICES).get();
  let list = snap.docs.map((d) => serializeInvoice(d.id, d.data()));
  if (req.query.status) list = list.filter((i) => i.status === req.query.status);
  list.sort((a, b) => String(b.ticketNumber || '').localeCompare(String(a.ticketNumber || '')));
  res.json(list);
}));

// GET /api/invoices/lookup?code= — busca un producto por código para el ticket.
router.get('/lookup', requireCashier, asyncHandler(async (req, res) => {
  const code = String(req.query.code || '').trim();
  if (!code) return res.status(400).json({ error: 'Código requerido.' });
  const snap = await db.collection(PRODUCTS).where('code', '==', code).limit(1).get();
  if (snap.empty) return res.status(404).json({ error: 'Producto no encontrado.' });
  const p = snap.docs[0].data();
  res.json({ productId: snap.docs[0].id, code: p.code, name: p.name, price: p.price || 0, stock: p.stock || 0 });
}));

// GET /api/invoices/search?q= — sugerencias de productos por código O nombre
// (para el buscador del ticket; a escala de la tienda se filtra en memoria).
router.get('/search', requireCashier, asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q.length < 2) return res.json([]);
  const snap = await db.collection(PRODUCTS).limit(500).get();
  const matches = snap.docs
    .map((d) => ({ productId: d.id, ...d.data() }))
    .filter((p) => String(p.code || '').toLowerCase().includes(q)
      || String(p.name || '').toLowerCase().includes(q))
    .sort((a, b) => {
      // Primero los que EMPIEZAN con lo buscado (código o nombre), luego el resto.
      const rank = (p) => (String(p.code || '').toLowerCase().startsWith(q) ? 0
        : String(p.name || '').toLowerCase().startsWith(q) ? 1 : 2);
      return rank(a) - rank(b) || String(a.name || '').localeCompare(String(b.name || ''));
    })
    .slice(0, 8)
    .map((p) => ({ productId: p.productId, code: p.code, name: p.name, price: p.price || 0, stock: p.stock || 0 }));
  res.json(matches);
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
  let reservations;
  try {
    reservations = await reserveForItems(toReserveInput(ticket.lines));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    const ticketNumber = await nextTicketNumber();
    const invoice = {
      ticketNumber,
      status: 'unlinked',
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
    await releaseReservation(reservations).catch(() => {});
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

  const oldReservations = inv.reservations || [];
  await releaseReservation(oldReservations);

  let reservations;
  try {
    reservations = await reserveForItems(toReserveInput(ticket.lines));
  } catch (err) {
    // Restaurar las reservas viejas (mejor esfuerzo) para no perder el respaldo.
    await reserveForItems((inv.items || []).map((it) => ({ code: it.productCode, quantity: it.quantity }))).catch(() => {});
    return res.status(400).json({ error: err.message });
  }

  await ref.update({
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

  await releaseReservation(inv.reservations || []);
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

module.exports = router;
