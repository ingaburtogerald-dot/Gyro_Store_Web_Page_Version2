// Facturación: generación de tickets POS y vinculación con ventas aprobadas.
const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireCashier, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { nextTicketNumber, computeTotals } = require('../services/invoice');

const INVOICES = config.collections.invoices;
const PRODUCTS = config.collections.products;
const ORDERS = config.collections.orders;

// GET /api/invoices — lista (cajero/admin). Filtro opcional ?status=unlinked|linked|paid
router.get('/', requireCashier, asyncHandler(async (req, res) => {
  const snap = await db.collection(INVOICES).get();
  let list = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.()?.toISOString() || null,
  }));
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
  res.json({ code: p.code, name: p.name, price: p.price || 0, stock: p.stock || 0 });
}));

// POST /api/invoices — genera un ticket (queda "sin vincular").
router.post('/', requireCashier, asyncHandler(async (req, res) => {
  const { items, discount, paymentMethod } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El ticket no tiene productos.' });
  }

  const { lines, subtotal, discount: disc, total } = computeTotals(items, discount);
  const ticketNumber = await nextTicketNumber();

  const invoice = {
    ticketNumber,
    items: lines,
    subtotal,
    discount: disc,
    total,
    paymentMethod: String(paymentMethod || 'Efectivo'),
    sellerName: req.user.name || req.user.email.split('@')[0],
    linkedToOrder: null,
    status: 'unlinked',
    createdAt: FieldValue.serverTimestamp(),
    linkedAt: null,
    paidAt: null,
  };
  const ref = await db.collection(INVOICES).add(invoice);
  res.status(201).json({ id: ref.id, ...invoice });
}));

// POST /api/invoices/:id/link — vincula un ticket con una venta aprobada (admin).
router.post('/:id/link', requireAdmin, asyncHandler(async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: 'Falta la venta a vincular.' });

  const invRef = db.collection(INVOICES).doc(req.params.id);
  const invSnap = await invRef.get();
  if (!invSnap.exists) return res.status(404).json({ error: 'Ticket no encontrado.' });

  const orderRef = db.collection(ORDERS).doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return res.status(404).json({ error: 'Venta no encontrada.' });

  await Promise.all([
    invRef.update({ linkedToOrder: orderId, status: 'linked', linkedAt: FieldValue.serverTimestamp() }),
    orderRef.update({ invoiceId: req.params.id }),
  ]);
  res.json({ ok: true });
}));

module.exports = router;
