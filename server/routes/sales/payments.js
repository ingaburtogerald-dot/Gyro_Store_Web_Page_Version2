// Pagos de comisiones (admin): historial de lotes, saldos por ajustes, saldar
// saldos aparte, aprobar-y-pagar en bulk, pago por semana y pago individual.
const router = require('express').Router();
const { db, FieldValue } = require('../../firebase');
const config = require('../../config');
const { requireAdmin } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/asyncHandler');
const { computeFinancials, getCostosFijosPct, round } = require('../../services/commission');
const { fifoForCode, consumeReservation, consumeMigratedReservation } = require('../../services/sales');
const { RATE } = require('../../services/inventory');
const {
  recordCommissionAdjustment, getPendingBalance, getAllPendingBalances, settleAdjustments,
} = require('../../services/balance');
const storage = require('../../services/storage');
const email = require('../../services/email');
const { ORDERS, upload, getISOWeekString, migratedFinancialsFromLines } = require('./helpers');

// GET /api/sales/payments — obtiene el historial de pagos realizados (lotes)
router.get('/payments', requireAdmin, asyncHandler(async (req, res) => {
  const snap = await db.collection(config.collections.payments).orderBy('createdAt', 'desc').get();
  res.json(snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    createdAt: d.data().createdAt?.toDate?.()?.toISOString() || null
  })));
}));

// PATCH /api/sales/payments/:id/date — permite editar la fecha de un registro de pago (útil para historial migrado)
router.patch('/payments/:id/date', requireAdmin, asyncHandler(async (req, res) => {
  const newDateStr = String(req.body.date);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(newDateStr);
  if (!m) {
    return res.status(400).json({ error: 'Fecha inválida. Formato esperado YYYY-MM-DD.' });
  }

  // Si envían "2026-01-15", creamos el Date de UTC a mediodía para evitar lios de zona horaria.
  const newDate = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));

  const ref = db.collection(config.collections.payments).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) {
    return res.status(404).json({ error: 'Pago no encontrado.' });
  }

  await ref.update({
    createdAt: newDate
  });

  res.json({ ok: true });
}));

// GET /api/sales/balances — saldos pendientes por vendedor (ajustes no saldados).
// Devuelve un mapa { [sellerEmail]: { sellerEmail, sellerName, balance, count } }.
router.get('/balances', requireAdmin, asyncHandler(async (req, res) => {
  res.json(await getAllPendingBalances());
}));

// POST /api/sales/settle-balance — salda el saldo pendiente de un vendedor con un
// pago/cobro aparte (sin esperar al próximo corte). Marca sus ajustes como saldados.
router.post('/settle-balance', requireAdmin, upload.single('receipt'), asyncHandler(async (req, res) => {
  const sellerEmail = String(req.body.sellerEmail || '').trim();
  if (!sellerEmail) return res.status(400).json({ error: 'sellerEmail es obligatorio.' });

  const { balance, adjustments } = await getPendingBalance(sellerEmail);
  if (balance === 0 || adjustments.length === 0) {
    return res.status(400).json({ error: 'Este vendedor no tiene saldo pendiente.' });
  }

  const paymentMethod = ['cash', 'deposit'].includes(req.body.paymentMethod) ? req.body.paymentMethod : 'cash';
  const noReceiptComment = req.body.noReceiptComment ? String(req.body.noReceiptComment).trim() : null;
  if (!req.file && !noReceiptComment) {
    return res.status(400).json({ error: 'Debes subir un comprobante o justificar su ausencia.' });
  }

  const sellerName = adjustments[0].sellerName || sellerEmail.split('@')[0];

  let receiptUrl = null;
  if (req.file) {
    const ext = (req.file.originalname.match(/\.[^.]+$/) || ['.png'])[0];
    receiptUrl = await storage.uploadFile(req.file.buffer, storage.folders.payment(), `${Date.now()}_settle_${sellerEmail}${ext}`, req.file.mimetype);
  }

  const userSnap = await db.collection(config.collections.users).where('email', '==', sellerEmail.toLowerCase()).limit(1).get();
  const sellerUser = userSnap.empty ? null : userSnap.docs[0].data();
  const isLocal = sellerUser && sellerUser.provider === 'local';

  const paymentRecord = {
    sellerEmail,
    sellerName,
    saleIds: [],
    totalComision: Math.max(0, balance), // si es a favor, es lo que se le pagó
    grossComision: 0,
    saldoAplicado: balance,
    isSettlement: true,
    paymentMethod,
    receiptUrl,
    noReceiptComment,
    notifiedVia: isLocal ? 'whatsapp' : 'email',
    createdAt: FieldValue.serverTimestamp(),
    createdBy: req.user.email,
  };
  const paymentRef = await db.collection(config.collections.payments).add(paymentRecord);
  await settleAdjustments(adjustments.map((a) => a.id), paymentRef.id);

  const dirNota = balance > 0
    ? `Se te pagó un saldo a favor de ${config.currency}${balance}.`
    : `Se registró el cobro de un saldo en contra de ${config.currency}${Math.abs(balance)}.`;
  let whatsappUrl = null;
  if (isLocal && sellerUser.whatsapp) {
    const msg = `Hola ${sellerName}, ${dirNota}${receiptUrl ? ' Comprobante registrado.' : (noReceiptComment ? ` Nota: ${noReceiptComment}` : '')}`;
    whatsappUrl = `https://wa.me/${sellerUser.whatsapp.replace(/\+/g, '')}?text=${encodeURIComponent(msg)}`;
  } else if (!isLocal && balance > 0) {
    email.sendPaymentMade({ to: sellerEmail, sellerName, amount: balance, saldoAplicado: balance, screenshotUrl: receiptUrl, ventasCount: 0, paymentMethod, noReceiptComment }).catch(() => {});
  }

  res.json({ ok: true, paymentId: paymentRef.id, balance, receiptUrl, whatsappUrl, notifiedVia: paymentRecord.notifiedVia });
}));

// POST /api/sales/approve-and-pay — aprueba ventas en bulk y las marca como pagadas (crea un lote de pago).
router.post('/approve-and-pay', requireAdmin, upload.single('receipt'), asyncHandler(async (req, res) => {
  const { saleIds: saleIdsRaw, paymentMethod, noReceiptComment } = req.body;
  const saleIds = JSON.parse(saleIdsRaw || '[]');
  if (!Array.isArray(saleIds) || saleIds.length === 0) {
    return res.status(400).json({ error: 'Debes seleccionar al menos una venta.' });
  }
  if (!['cash', 'deposit'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'Método de pago inválido.' });
  }
  if (!req.file && (!noReceiptComment || !String(noReceiptComment).trim())) {
    return res.status(400).json({ error: 'Debes subir un comprobante o ingresar un comentario que justifique su ausencia.' });
  }

  let baseDate = new Date();
  let serverDate = FieldValue.serverTimestamp();
  if (req.body.paymentDate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(req.body.paymentDate));
    if (m) {
      baseDate = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
      serverDate = baseDate;
    }
  }

  // 1. Obtener todas las ventas y validar que pertenezcan al mismo vendedor y estén pendientes
  // Usamos una transacción para "bloquearlas" atómicamente y evitar duplicados por peticiones concurrentes
  const sales = [];
  try {
    await db.runTransaction(async (t) => {
      sales.length = 0; // limpiar por si la transacción reintenta
      const snaps = await Promise.all(saleIds.map(id => t.get(db.collection(ORDERS).doc(id))));
      for (let i = 0; i < snaps.length; i++) {
        const snap = snaps[i];
        const id = saleIds[i];
        if (!snap.exists) throw new Error(`Venta ${id} no encontrada.`);
        const order = snap.data();
        if (order.status !== 'pending_approval') {
          throw new Error(`La venta ${id} ya no está pendiente.`);
        }
        sales.push({ id, ...order });
        t.update(snap.ref, { status: 'processing_approval' });
      }
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const sellerEmail = sales[0].sellerEmail;
  const sellerName = sales[0].sellerName;
  if (sales.some((s) => s.sellerEmail !== sellerEmail)) {
    // revertir
    const revertBatch = db.batch();
    saleIds.forEach(id => revertBatch.update(db.collection(ORDERS).doc(id), { status: 'pending_approval' }));
    await revertBatch.commit();
    return res.status(400).json({ error: 'Todas las ventas seleccionadas deben ser del mismo vendedor.' });
  }

  try {

  const weekOf = getISOWeekString(baseDate);

  // 2. VALIDAR el stock de TODO el lote ANTES de escribir nada. Las ventas con
  //    reserva (nativa o migrada) ya tienen stock apartado; solo las órdenes FIFO
  //    sin reserva pueden quedarse sin stock. Se agrega la demanda por código de
  //    todas esas órdenes y se verifica una sola vez: si algo no alcanza, se aborta
  //    aquí, sin haber tocado ninguna venta ni el inventario.
  const fifoDemand = new Map();
  for (const order of sales) {
    if (order.saleOrigin === 'migrated') continue;
    if ((order.reservations || []).length > 0) continue;
    for (const it of order.items) fifoDemand.set(it.code, (fifoDemand.get(it.code) || 0) + it.quantity);
  }
  for (const [code, qty] of fifoDemand) {
    try {
      await fifoForCode(code, qty, false); // solo verifica disponibilidad (no consume)
    } catch (err) {
      const revertBatch = db.batch();
      saleIds.forEach(id => revertBatch.update(db.collection(ORDERS).doc(id), { status: 'pending_approval' }));
      await revertBatch.commit();
      return res.status(400).json({ error: err.message });
    }
  }

  // 3. Consumir inventario y calcular financieros de cada venta, ACUMULANDO los
  //    cambios de estado en memoria (todavía sin marcar ninguna como pagada).
  let totalComision = 0;
  const statusUpdates = [];
  for (const order of sales) {
    const reservations = order.reservations || [];
    const updatedItems = [];
    let fin;

    if (order.saleOrigin === 'migrated') {
      await consumeMigratedReservation(reservations);
      fin = migratedFinancialsFromLines(order.items, order.saleTotal);
      updatedItems.push(...fin.linesFinancials);
    } else {
      if (reservations.length > 0) {
        await consumeReservation(reservations);
        const costByCode = {};
        for (const r of reservations) {
          costByCode[r.code] = (costByCode[r.code] || 0) + r.unitFinalUsd * RATE * r.quantity;
        }
        for (const it of order.items) {
          it.lineCost = costByCode[it.code] || 0;
        }
      } else {
        for (const it of order.items) {
          it.lineCost = await fifoForCode(it.code, it.quantity, true);
        }
      }
      fin = computeFinancials({ lines: order.items });
      updatedItems.push(...fin.linesFinancials);
    }

    totalComision += fin.comisionVendedor;

    statusUpdates.push({
      id: order.id,
      payload: {
        ...fin,
        totalSaleAmount: order.saleTotal,
        totalCostReal: fin.costReal,
        totalUtilidadBruta: fin.utilidadBruta,
        totalCostosFijos: fin.costosFijos,
        totalUtilidadNeta: fin.utilidadNeta,
        items: updatedItems,
        status: 'paid', // Directamente a pagado
        approvedAt: serverDate,
        approvedBy: req.user.email,
        weekOf,
      },
    });
  }

  // 4. Subir comprobante a Storage si se proporcionó
  let receiptUrl = null;
  if (req.file) {
    const ext = (req.file.originalname.match(/\.[^.]+$/) || ['.png'])[0];
    receiptUrl = await storage.uploadFile(
      req.file.buffer,
      storage.folders.payment(),
      `${Date.now()}_${sellerEmail}${ext}`,
      req.file.mimetype
    );
  }

  // 4.5. Aplicar el saldo pendiente del vendedor (ajustes por ediciones de ventas pagadas).
  //   saldoAplicado > 0 → la tienda le debía: se suma al pago.
  //   saldoAplicado < 0 → recibió de más: se descuenta del pago.
  const grossComision = round(totalComision);
  const { balance: saldoAplicado, adjustments: pendingAdjustments } = await getPendingBalance(sellerEmail);
  const netToPay = round(grossComision + saldoAplicado);
  const totalPagado = Math.max(0, netToPay);

  // 5. Ver tipo de usuario para notificar
  const userSnap = await db.collection(config.collections.users).where('email', '==', sellerEmail.toLowerCase()).limit(1).get();
  const sellerUser = userSnap.empty ? null : userSnap.docs[0].data();
  const isLocal = sellerUser && sellerUser.provider === 'local';

  const paymentRecord = {
    sellerEmail,
    sellerName,
    saleIds,
    totalComision: totalPagado, // lo realmente entregado (comisión bruta ± saldo)
    grossComision,              // comisión bruta de las ventas del lote
    saldoAplicado,              // ajuste aplicado (+ a favor / − en contra)
    paymentMethod,
    receiptUrl,
    noReceiptComment: noReceiptComment ? String(noReceiptComment).trim() : null,
    notifiedVia: isLocal ? 'whatsapp' : 'email',
    createdAt: serverDate,
    createdBy: req.user.email,
  };

  // 6. Aplicar TODO en un solo batch atómico: marcar cada venta como pagada Y crear
  //    el lote de pago juntos. Un batch es todo-o-nada, así que ya no puede quedar
  //    "media tanda" pagada y el resto pendiente si algo falla al escribir.
  const paymentRef = db.collection(config.collections.payments).doc();
  const batch = db.batch();
  for (const u of statusUpdates) batch.update(db.collection(ORDERS).doc(u.id), u.payload);
  batch.set(paymentRef, paymentRecord);
  await batch.commit();

  // 6.5. Saldar los ajustes aplicados. Si el saldo en contra superó la comisión del
  // lote (netToPay < 0), el vendedor aún debe: se arrastra como un nuevo ajuste.
  await settleAdjustments(pendingAdjustments.map((a) => a.id), paymentRef.id).catch(() => {});
  if (netToPay < 0) {
    await recordCommissionAdjustment({
      sellerEmail, sellerName, saleId: null,
      comisionVieja: 0, comisionNueva: netToPay,
      reason: 'Saldo en contra arrastrado: la comisión de este pago no alcanzó a cubrirlo.',
      by: req.user.email,
    }).catch(() => {});
  }

  // 6. Notificar
  const saldoNota = saldoAplicado > 0
    ? ` Incluye ${config.currency}${saldoAplicado} de saldo a tu favor por ajustes.`
    : saldoAplicado < 0
      ? ` Se descontó ${config.currency}${Math.abs(saldoAplicado)} por un saldo en contra (ajuste de venta).${netToPay < 0 ? ` Queda un saldo pendiente de ${config.currency}${Math.abs(netToPay)} para tu próximo pago.` : ''}`
      : '';

  let whatsappUrl = null;
  if (isLocal) {
    if (sellerUser.whatsapp) {
      const msg = `Hola ${sellerName}, se te ha realizado un pago de ${config.currency}${totalPagado} por ${saleIds.length} venta(s) mediante ${paymentMethod === 'cash' ? 'efectivo' : 'depósito'}.${saldoNota}${receiptUrl ? ' Tu comprobante ha sido registrado en el sistema.' : (noReceiptComment ? ` Nota: ${noReceiptComment}` : '')}`;
      whatsappUrl = `https://wa.me/${sellerUser.whatsapp.replace(/\+/g, '')}?text=${encodeURIComponent(msg)}`;
    }
  } else {
    email.sendPaymentMade({
      to: sellerEmail,
      sellerName,
      amount: totalPagado,
      saldoAplicado,
      screenshotUrl: receiptUrl,
      ventasCount: saleIds.length,
      paymentMethod,
      noReceiptComment: paymentRecord.noReceiptComment,
    }).catch(() => {});
  }

  res.json({ ok: true, paymentId: paymentRef.id, receiptUrl, whatsappUrl, paymentMethod, notifiedVia: paymentRecord.notifiedVia, grossComision, saldoAplicado, totalPagado });

  } catch (err) {
    // If anything fails during processing, revert the locks
    const revertBatch = db.batch();
    saleIds.forEach(id => revertBatch.update(db.collection(ORDERS).doc(id), { status: 'pending_approval' }));
    await revertBatch.commit();
    
    // Si ya sabíamos qué responder (como el error de firebase), lo mandamos. Si no, 500.
    return res.status(500).json({ error: 'Error procesando el pago. Se revirtieron las ventas. ' + err.message });
  }
}));

// POST /api/sales/pay-week — marcar semana como pagada y subir captura.
router.post('/pay-week', requireAdmin, upload.single('screenshot'), asyncHandler(async (req, res) => {
  const sellerEmail = String(req.body.sellerEmail || '').trim();
  const weekOf = String(req.body.weekOf || '').trim();
  if (!sellerEmail || !weekOf) {
    return res.status(400).json({ error: 'sellerEmail y weekOf son obligatorios.' });
  }

  const snap = await db.collection(ORDERS)
    .where('sellerEmail', '==', sellerEmail)
    .where('weekOf', '==', weekOf)
    .where('status', '==', 'approved')
    .get();

  if (snap.empty) {
    return res.status(400).json({ error: 'No hay ventas aprobadas para pagar para este vendedor en la semana indicada.' });
  }

  let paymentScreenshotUrl = '';
  if (req.file) {
    const ext = (req.file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0];
    paymentScreenshotUrl = await storage.uploadFile(req.file.buffer, storage.folders.paymentScreenshot(), `${Date.now()}${ext}`, req.file.mimetype);
  }

  const batch = db.batch();
  let totalCommission = 0;
  let sellerName = '';

  snap.docs.forEach((doc) => {
    totalCommission += doc.data().comisionVendedor || 0;
    if (!sellerName) sellerName = doc.data().sellerName;
    batch.update(doc.ref, {
      status: 'paid',
      invoiceId: req.body.invoiceId || null,
      paymentScreenshotUrl: paymentScreenshotUrl || null,
      paidAt: FieldValue.serverTimestamp(),
    });
  });

  await batch.commit();

  email.sendPaymentMade({
    to: sellerEmail,
    sellerName: sellerName || sellerEmail.split('@')[0],
    amount: totalCommission,
    screenshotUrl: paymentScreenshotUrl || null,
  }).catch(() => {});

  res.json({ ok: true });
}));

// POST /api/sales/:id/pay — pago individual (backward compatibility).
router.post('/:id/pay', requireAdmin, upload.single('screenshot'), asyncHandler(async (req, res) => {
  const ref = db.collection(ORDERS).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Venta no encontrada.' });
  const order = snap.data();
  if (order.status !== 'approved') return res.status(400).json({ error: 'Solo se pagan ventas aprobadas.' });

  let paymentScreenshotUrl = '';
  if (req.file) {
    const ext = (req.file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0];
    paymentScreenshotUrl = await storage.uploadFile(req.file.buffer, storage.folders.paymentScreenshot(), `${Date.now()}${ext}`, req.file.mimetype);
  }

  await ref.update({
    status: 'paid',
    invoiceId: req.body.invoiceId || order.invoiceId || null,
    paymentScreenshotUrl,
    paidAt: FieldValue.serverTimestamp(),
  });

  email
    .sendPaymentMade({ to: order.sellerEmail, sellerName: order.sellerName, amount: order.comisionVendedor || 0, screenshotUrl: paymentScreenshotUrl })
    .catch(() => {});

  res.json({ ok: true });
}));

module.exports = router;
