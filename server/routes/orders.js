// Órdenes públicas del catálogo (checkout por WhatsApp).
// PRINCIPIO CLAVE (reciclado): los precios y totales SIEMPRE se recalculan en el
// servidor con los datos reales de Firestore. Nunca se confía en lo que manda el cliente.
const router = require('express').Router();
const { z } = require('zod');
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAdmin } = require('../middleware/auth');

const CATALOG = config.collections.catalog;
const PRODUCTS = config.collections.products;
const PUBLIC_ORDERS = config.collections.publicOrders;

const orderSchema = z.object({
  customerName: z.string().min(2).max(80),
  customerPhone: z.string().min(7).max(20),
  deliveryMethod: z.enum(['retiro', 'envio']),
  address: z.string().max(200).optional().default(''),
  note: z.string().max(500).optional().default(''),
  items: z
    .array(
      z.object({
        catalogId: z.string().min(1),
        variantId: z.string().optional().default(''),
        variantName: z.string().optional().default('Estándar'),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, 'El pedido no tiene productos.'),
});

// Resuelve el precio real de una línea desde Firestore (variante o catálogo).
async function resolveLinePrice(item) {
  if (item.variantId) {
    const pDoc = await db.collection(PRODUCTS).doc(item.variantId).get();
    if (pDoc.exists && !pDoc.data().deletedAt) {
      return { price: pDoc.data().price || 0, name: pDoc.data().name };
    }
  }
  const cDoc = await db.collection(CATALOG).doc(item.catalogId).get();
  if (cDoc.exists) return { price: cDoc.data().price || 0, name: cDoc.data().name };
  return null;
}

function buildWhatsappMessage(order) {
  let msg = '¡Hola Gyro Store! 👋 Quiero confirmar este pedido:\n\n';
  msg += `👤 ${order.customerName}\n📞 ${order.customerPhone}\n`;
  msg += order.deliveryMethod === 'envio' ? `🚚 Envío a: ${order.address}\n` : '🏬 Retiro en tienda\n';
  if (order.note) msg += `📝 ${order.note}\n`;
  msg += '\nProductos:\n';
  order.items.forEach((l) => {
    const v = l.variantName && l.variantName !== 'Estándar' ? ` (${l.variantName})` : '';
    msg += `• ${l.name}${v} x${l.quantity} — ${config.currency}${l.lineTotal.toLocaleString('es-NI')}\n`;
  });
  msg += `\nSubtotal: ${config.currency}${order.subtotal.toLocaleString('es-NI')}`;
  if (order.discount > 0) msg += `\nDescuento: -${config.currency}${order.discount.toLocaleString('es-NI')}`;
  msg += `\n*Total: ${config.currency}${order.total.toLocaleString('es-NI')}*`;
  return `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(msg)}`;
}

// POST /api/orders/public — crea la orden y devuelve la URL de WhatsApp.
router.post('/public', asyncHandler(async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Datos inválidos.' });
  }
  const data = parsed.data;
  if (data.deliveryMethod === 'envio' && data.address.trim().length < 5) {
    return res.status(400).json({ error: 'La dirección es obligatoria para envío.' });
  }

  // Recalcula cada línea con el precio real de Firestore.
  const items = [];
  let subtotal = 0;
  for (const it of data.items) {
    const resolved = await resolveLinePrice(it);
    if (!resolved) continue;
    const lineTotal = resolved.price * it.quantity;
    subtotal += lineTotal;
    items.push({
      catalogId: it.catalogId,
      variantId: it.variantId,
      variantName: it.variantName,
      name: resolved.name,
      quantity: it.quantity,
      price: resolved.price,
      lineTotal,
    });
  }
  if (items.length === 0) return res.status(400).json({ error: 'Ningún producto es válido.' });

  // Descuento por volumen — tabla multi-nivel desde Firestore o default
  const totalQty = items.reduce((n, l) => n + l.quantity, 0);
  let discountPercent = 0;
  try {
    const pricingDoc = await db.collection(config.collections.appConfig).doc('pricing').get();
    const tiers = pricingDoc.exists
      ? pricingDoc.data().wholesaleDiscounts
      : [
          { minQty: 2, maxQty: 2, discountPercent: 3 },
          { minQty: 3, maxQty: 5, discountPercent: 5 },
          { minQty: 6, maxQty: 11, discountPercent: 10 },
          { minQty: 12, maxQty: null, discountPercent: 15 },
        ];
    for (const tier of (tiers || [])) {
      const inRange = totalQty >= tier.minQty && (tier.maxQty == null || totalQty <= tier.maxQty);
      if (inRange) { discountPercent = tier.discountPercent; break; }
    }
  } catch { /* usa 0% si falla */ }
  const discount = discountPercent > 0 ? subtotal * (discountPercent / 100) : 0;
  const total = subtotal - discount;

  const order = {
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    deliveryMethod: data.deliveryMethod,
    address: data.address,
    note: data.note,
    items,
    subtotal,
    discount,
    total,
    createdAt: FieldValue.serverTimestamp(),
  };

  const whatsappUrl = buildWhatsappMessage(order);
  const ref = await db.collection(PUBLIC_ORDERS).add({ ...order, whatsappUrl });

  res.status(201).json({ id: ref.id, subtotal, discount, total, whatsappUrl });
}));

// GET /api/orders/public — lista todos los pedidos del catálogo (admin).
router.get('/public', requireAdmin, asyncHandler(async (req, res) => {
  const snap = await db.collection(PUBLIC_ORDERS).orderBy('createdAt', 'desc').limit(200).get();
  const list = snap.docs.map((d) => {
    const o = d.data();
    return {
      id: d.id,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      deliveryMethod: o.deliveryMethod,
      address: o.address || '',
      note: o.note || '',
      items: o.items || [],
      subtotal: o.subtotal || 0,
      discount: o.discount || 0,
      total: o.total || 0,
      contacted: o.contacted || false,
      contactedAt: o.contactedAt?.toDate?.()?.toISOString() || null,
      contactedBy: o.contactedBy || null,
      createdAt: o.createdAt?.toDate?.()?.toISOString() || null,
    };
  });
  res.json(list);
}));

// PATCH /api/orders/public/:id/contacted — marcar si se contactó al cliente.
router.patch('/public/:id/contacted', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(PUBLIC_ORDERS).doc(req.params.id);
  if (!(await ref.get()).exists) return res.status(404).json({ error: 'Pedido no encontrado.' });
  const contacted = Boolean(req.body.contacted);
  await ref.update({
    contacted,
    contactedAt: contacted ? FieldValue.serverTimestamp() : null,
    contactedBy: contacted ? req.user?.email || null : null,
  });
  res.json({ ok: true });
}));

module.exports = router;
