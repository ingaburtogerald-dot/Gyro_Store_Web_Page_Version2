const { z } = require('zod');
const { db, FieldValue, Timestamp } = require('../firebase');
const config = require('../config');
const { paginateQuery } = require('../utils/pagination');
const { getComboEnrichedById } = require('./combos');
const { redeemDiscountCode } = require('../routes/discountCodes');

const CATALOG = config.collections.catalog;
const PRODUCTS = config.collections.products;
const PUBLIC_ORDERS = config.collections.publicOrders;

const orderSchema = z.object({
  customerName: z.string().min(2).max(80),
  customerPhone: z.string().min(7).max(20),
  deliveryMethod: z.enum(['retiro', 'envio']),
  address: z.string().max(200).optional().default(''),
  locationUrl: z.string().max(300).optional().default(''),
  note: z.string().max(500).optional().default(''),
  discountCode: z.string().max(30).optional().default(''),
  items: z
    .array(
      z.object({
        catalogId: z.string().optional().default(''),
        comboId: z.string().optional().default(''),
        variantId: z.string().optional().default(''),
        variantName: z.string().optional().default('Estándar'),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, 'El pedido no tiene productos.'),
});

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
  const money = (n) => `${config.currency}${Number(n || 0).toLocaleString('es-NI')}`;
  const div = '━━━━━━━━━━━━━━━';

  let msg = '🛒 *NUEVO PEDIDO — Gyro Store*\n';
  msg += `${div}\n`;
  msg += `👤 *${order.customerName}*\n`;
  msg += `📞 ${order.customerPhone}\n`;
  if (order.deliveryMethod === 'envio') {
    msg += '🚚 *Envío a domicilio*\n';
    if (order.address) msg += `📍 ${order.address}\n`;
    if (order.locationUrl) msg += `🗺️ Ubicación: ${order.locationUrl}\n`;
  } else {
    msg += '🏬 *Retiro en tienda*\n';
  }
  if (order.note) msg += `📝 _${order.note}_\n`;

  msg += `${div}\n`;
  msg += '🛍️ *Mi pedido*\n\n';
  order.items.forEach((l) => {
    if (l.kind === 'combo') {
      const contenido = (l.products || []).map((p) => p.name).join(' + ');
      msg += `🎁 *${l.name}*  ×${l.quantity}\n`;
      if (contenido) msg += `   _${contenido}_\n`;
      msg += `   💵 ${money(l.lineTotal)}\n\n`;
      return;
    }
    const v = l.variantName && l.variantName !== 'Estándar' ? `  _(${l.variantName})_` : '';
    msg += `🔹 *${l.name}*${v}  ×${l.quantity}\n`;
    msg += `   💵 ${money(l.lineTotal)}\n\n`;
  });

  msg += `${div}\n`;
  msg += `Subtotal:  ${money(order.subtotal)}\n`;
  if (order.discount > 0) msg += `🏷️ Descuento por volumen:  -${money(order.discount)}\n`;
  if (order.codeDiscount > 0) msg += `🎟️ Código ${order.discountCode}:  -${money(order.codeDiscount)}\n`;
  msg += `💰 *TOTAL:  ${money(order.total)}*\n`;
  msg += `${div}\n`;
  msg += '_¡Gracias! Quedo atento(a) para coordinar el pago._ 🙌';

  return `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(msg)}`;
}

async function createPublicOrder(body) {
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message || 'Datos inválidos.');
  }
  const data = parsed.data;
  if (data.deliveryMethod === 'envio' && data.address.trim().length < 5 && !data.locationUrl) {
    throw new Error('Agrega tu dirección o comparte tu ubicación para el envío.');
  }

  const items = [];
  let comboSubtotal = 0;   
  let productSubtotal = 0; 
  let productQty = 0;
  for (const it of data.items) {
    if (it.comboId) {
      const combo = await getComboEnrichedById(it.comboId);
      if (!combo || !combo.active || combo.broken) continue;
      const lineTotal = combo.price * it.quantity;
      comboSubtotal += lineTotal;
      items.push({
        kind: 'combo',
        comboId: combo.id,
        name: combo.name,
        products: combo.products.map((p) => ({ id: p.id, name: p.name })),
        variantName: '',
        quantity: it.quantity,
        price: combo.price,
        lineTotal,
      });
      continue;
    }
    if (!it.catalogId) continue;
    const resolved = await resolveLinePrice(it);
    if (!resolved) continue;
    const lineTotal = resolved.price * it.quantity;
    productSubtotal += lineTotal;
    productQty += it.quantity;
    items.push({
      kind: 'product',
      catalogId: it.catalogId,
      variantId: it.variantId,
      variantName: it.variantName,
      name: resolved.name,
      quantity: it.quantity,
      price: resolved.price,
      lineTotal,
    });
  }
  if (items.length === 0) throw new Error('Ningún producto es válido.');

  const subtotal = productSubtotal + comboSubtotal;
  const totalQty = productQty;
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
  const discount = discountPercent > 0 ? productSubtotal * (discountPercent / 100) : 0;
  const afterVolumeDiscount = subtotal - discount;

  let codeDiscount = 0;
  let discountCode = '';
  if (data.discountCode) {
    const redeemed = await redeemDiscountCode(data.discountCode);
    if (!redeemed.ok) {
      throw new Error(redeemed.error || 'Código de descuento inválido.');
    }
    discountCode = redeemed.code;
    codeDiscount = redeemed.type === 'percent'
      ? afterVolumeDiscount * (redeemed.value / 100)
      : Math.min(redeemed.value, afterVolumeDiscount);
  }
  const total = afterVolumeDiscount - codeDiscount;

  const order = {
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    deliveryMethod: data.deliveryMethod,
    address: data.address,
    locationUrl: data.locationUrl,
    note: data.note,
    items,
    subtotal,
    discount,
    discountCode,
    codeDiscount,
    total,
    createdAt: FieldValue.serverTimestamp(),
  };

  const whatsappUrl = buildWhatsappMessage(order);
  const ref = await db.collection(PUBLIC_ORDERS).add({ ...order, whatsappUrl });

  if (config.n8nWebhookUrl) {
    fetch(config.n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.n8nWebhookSecret ? { 'Authorization': `Bearer ${config.n8nWebhookSecret}` } : {}),
      },
      body: JSON.stringify({
        event: 'new_order',
        orderId: ref.id,
        orderData: {
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          deliveryMethod: order.deliveryMethod,
          total: order.total,
          itemsCount: order.items.length,
          whatsappUrl: whatsappUrl,
        }
      })
    }).catch(err => console.error('⚠️ Error enviando webhook a n8n:', err.message));
  }

  return { id: ref.id, subtotal, discount, codeDiscount, total, whatsappUrl };
}

function publicOrderView(doc) {
  const o = doc.data();
  return {
    id: doc.id,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    deliveryMethod: o.deliveryMethod,
    address: o.address || '',
    locationUrl: o.locationUrl || '',
    note: o.note || '',
    items: o.items || [],
    subtotal: o.subtotal || 0,
    discount: o.discount || 0,
    discountCode: o.discountCode || '',
    codeDiscount: o.codeDiscount || 0,
    total: o.total || 0,
    contacted: o.contacted || false,
    contactedAt: o.contactedAt?.toDate?.()?.toISOString() || null,
    contactedBy: o.contactedBy || null,
    contactAttempts: o.contactAttempts || 0,
    archived: o.archived || false,
    createdAt: o.createdAt?.toDate?.()?.toISOString() || null,
  };
}

async function getPublicOrders(query) {
  const paginated = query.limit !== undefined || query.cursor !== undefined;

  if (!paginated) {
    const snap = await db.collection(PUBLIC_ORDERS).orderBy('createdAt', 'desc').limit(200).get();
    return snap.docs.map(publicOrderView);
  }

  const { docs, hasMore, nextCursor } = await paginateQuery(db.collection(PUBLIC_ORDERS), {
    orderField: 'createdAt',
    direction: 'desc',
    limit: query.limit,
    cursor: query.cursor,
    decodeCursor: (iso) => Timestamp.fromDate(new Date(iso)),
    encodeCursor: (ts) => ts?.toDate?.()?.toISOString() || null,
  });

  return { items: docs.map(publicOrderView), nextCursor, hasMore };
}

async function markContacted(id, contacted, userEmail) {
  const ref = db.collection(PUBLIC_ORDERS).doc(id);
  if (!(await ref.get()).exists) throw new Error('Pedido no encontrado.');
  await ref.update({
    contacted,
    contactedAt: contacted ? FieldValue.serverTimestamp() : null,
    contactedBy: contacted ? userEmail || null : null,
  });
}

async function markFollowUp(id, userEmail) {
  const ref = db.collection(PUBLIC_ORDERS).doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Pedido no encontrado.');
  
  const currentAttempts = doc.data().contactAttempts || 0;
  const newAttempts = currentAttempts + 1;
  const isArchived = newAttempts >= 3;

  await ref.update({
    contactAttempts: newAttempts,
    archived: isArchived,
    lastFollowUpAt: FieldValue.serverTimestamp(),
    lastFollowUpBy: userEmail || null,
  });

  return { contactAttempts: newAttempts, archived: isArchived };
}

async function deletePublicOrder(id) {
  const ref = db.collection(PUBLIC_ORDERS).doc(id);
  if (!(await ref.get()).exists) throw new Error('Pedido no encontrado.');
  await ref.delete();
}

module.exports = {
  createPublicOrder,
  getPublicOrders,
  markContacted,
  markFollowUp,
  deletePublicOrder
};
