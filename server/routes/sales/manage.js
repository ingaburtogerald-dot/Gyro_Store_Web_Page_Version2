// Gestión del ciclo de vida de una venta (admin): aprobar, rechazar, editar,
// eliminar y procesar garantías. Aquí se consume/revierte el stock reservado
// y se fijan los financieros definitivos.
const router = require('express').Router();
const { db, FieldValue } = require('../../firebase');
const config = require('../../config');
const { requireAdmin } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/asyncHandler');
const { computeFinancials, getCostosFijosPct, getCostosFijosConfig, round } = require('../../services/commission');
const {
  fifoForCode, reserveForItems, releaseReservation, consumeReservation,
  reserveForMigratedItems, releaseMigratedReservation, consumeMigratedReservation,
  restockApprovedNative, restockApprovedMigrated,
} = require('../../services/sales');
const { RATE } = require('../../services/inventory');
const { recordCommissionAdjustment } = require('../../services/balance');
const storage = require('../../services/storage');
const email = require('../../services/email');
const {
  ORDERS, upload, getISOWeekString, buildLines, migratedFinancialsFromLines, validatePriceFloor, releaseAny,
} = require('./helpers');

// POST /api/sales/:id/approve — descuenta inventario FIFO y fija los financieros.
router.post('/:id/approve', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(ORDERS).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Venta no encontrada.' });
  const order = snap.data();
  if (order.status !== 'pending_approval') {
    return res.status(400).json({ error: 'Solo se aprueban ventas pendientes.' });
  }

  const reservations = order.reservations || [];
  const updatedItems = [];
  let fin;

  if (order.saleOrigin === 'migrated') {
    // Migrado: consume del lote migrado (mueve "Salidas") y calcula M1/M2 por línea.
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
      // Compatibilidad con órdenes sin reservas (registradas antes de este cambio)
      try {
        for (const it of order.items) await fifoForCode(it.code, it.quantity, false);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
      for (const it of order.items) {
        it.lineCost = await fifoForCode(it.code, it.quantity, true);
      }
    }

    const costosFijosConfig = await getCostosFijosConfig();
    fin = computeFinancials({ lines: order.items, costosFijosConfig });
    updatedItems.push(...fin.linesFinancials);
  }
  const approvedDate = new Date();
  const weekOf = getISOWeekString(approvedDate);

  const updatePayload = {
    ...fin,
    totalSaleAmount: order.saleTotal,
    totalCostReal: fin.costReal,
    totalUtilidadBruta: fin.utilidadBruta,
    totalCostosFijos: fin.costosFijos,
    totalUtilidadNeta: fin.utilidadNeta,
    items: updatedItems,
    status: 'approved',
    approvedAt: FieldValue.serverTimestamp(),
    approvedBy: req.user.email,
    weekOf,
  };

  await ref.update(updatePayload);

  const isLocal = order.sellerEmail.endsWith(`@${config.internalDomain}`);
  if (!isLocal) {
    email
      .sendSaleApproved({
        to: order.sellerEmail,
        sellerName: order.sellerName,
        products: order.items.map((l) => l.name).join(', '),
        comision: fin.comisionVendedor,
      })
      .catch(() => {});
  }

  res.json({ ok: true, ...fin });
}));

// POST /api/sales/:id/reject — requiere motivo.
router.post('/:id/reject', requireAdmin, asyncHandler(async (req, res) => {
  const reason = String(req.body.reason || '').trim();
  if (!reason) return res.status(400).json({ error: 'El motivo de rechazo es obligatorio.' });
  const ref = db.collection(ORDERS).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Venta no encontrada.' });
  if (snap.data().status === 'approved') {
    return res.status(400).json({ error: 'No se puede rechazar una venta aprobada.' });
  }

  const order = snap.data();

  // Liberar stock reservado (FIFO nativo o lote migrado)
  if (order.reservations?.length > 0) {
    if (order.saleOrigin === 'migrated') {
      await releaseMigratedReservation(order.reservations).catch(() => {});
    } else {
      await releaseReservation(order.reservations).catch(() => {});
    }
  }

  await ref.update({ status: 'rejected', rejectionReason: reason, rejectedAt: FieldValue.serverTimestamp() });
  const isLocal = order.sellerEmail.endsWith(`@${config.internalDomain}`);
  if (!isLocal) {
    email
      .sendSaleRejected({ to: order.sellerEmail, sellerName: order.sellerName, products: order.items.map((l) => l.name).join(', '), reason })
      .catch(() => {});
  }
  res.json({ ok: true });
}));

// PUT /api/sales/:id — edita una venta PENDIENTE (admin): productos, cantidades,
// precios y vendedor. Re-reserva stock; si la nueva reserva falla, restaura la vieja.
router.put('/:id', requireAdmin, upload.single('receipt'), asyncHandler(async (req, res) => {
  const ref = db.collection(ORDERS).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Venta no encontrada.' });
  const order = snap.data();
  if (order.status !== 'pending_approval' && order.status !== 'approved' && order.status !== 'paid') {
    return res.status(400).json({ error: 'Estado de venta no válido para editar.' });
  }

  const editReason = req.body.editReason ? String(req.body.editReason).trim() : '';
  if (order.status !== 'pending_approval' && !editReason) {
    return res.status(400).json({ error: 'Para editar una venta ya procesada debes ingresar un motivo.' });
  }

  let items;
  try {
    items = typeof req.body.items === 'string' ? JSON.parse(req.body.items) : req.body.items;
  } catch {
    return res.status(400).json({ error: 'Datos de la venta inválidos.' });
  }

  let built;
  try {
    built = await buildLines(items);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const { lines, saleTotal, saleOrigin } = built;
  if (!lines.length) return res.status(400).json({ error: 'La venta no tiene productos válidos.' });

  try {
    if (saleOrigin === 'migrated') migratedFinancialsFromLines(lines, saleTotal);
    else await validatePriceFloor(lines);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Liberar reservas viejas, reservar nuevas; si falla, restaurar las viejas.
  const oldReservations = order.reservations || [];
  const oldOrigin = order.saleOrigin || 'native';

  if (order.status === 'pending_approval') {
    await releaseAny(oldOrigin, oldReservations);
  } else if (order.status === 'approved' || order.status === 'paid') {
    if (oldOrigin === 'migrated') await restockApprovedMigrated(oldReservations);
    else await restockApprovedNative(oldReservations);
  }

  let reservations = [];
  try {
    reservations = saleOrigin === 'migrated'
      ? await reserveForMigratedItems(lines.map((l) => ({ migratedId: l.migratedId, quantity: l.quantity })))
      : await reserveForItems(lines.map((l) => ({ code: l.code, quantity: l.quantity })));
  } catch (err) {
    try {
      if (oldOrigin === 'migrated') {
        await reserveForMigratedItems((order.items || []).map((it) => ({ migratedId: it.migratedId || it.productId, quantity: it.quantity })));
      } else {
        await reserveForItems((order.items || []).map((it) => ({ code: it.code, quantity: it.quantity })));
      }
    } catch { /* mejor esfuerzo */ }
    return res.status(400).json({ error: err.message });
  }

  const update = {
    items: lines,
    saleTotal,
    totalSaleAmount: saleTotal,
    saleOrigin,
    reservations,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (order.status === 'approved' || order.status === 'paid') {
    const oldComision = order.comisionVendedor || 0;
    let fin;
    if (saleOrigin === 'migrated') {
      await consumeMigratedReservation(reservations);
      fin = migratedFinancialsFromLines(lines, saleTotal);
      update.items = fin.linesFinancials;
    } else {
      await consumeReservation(reservations);
      const costByCode = {};
      for (const r of reservations) {
        costByCode[r.code] = (costByCode[r.code] || 0) + r.unitFinalUsd * RATE * r.quantity;
      }
      for (const it of lines) {
        it.lineCost = costByCode[it.code] || 0;
      }
      const cfConfig = await getCostosFijosConfig();
      fin = computeFinancials({ lines, costosFijosConfig: cfConfig });
      update.items = fin.linesFinancials;
    }
    update.totalCostReal = fin.costReal;
    update.totalUtilidadBruta = fin.utilidadBruta;
    update.totalCostosFijos = fin.costosFijos;
    update.totalUtilidadNeta = fin.utilidadNeta;
    if (fin.comisionVendedor !== undefined) update.comisionVendedor = fin.comisionVendedor;
    if (fin.comisionPercent !== undefined) update.comisionPercent = fin.comisionPercent;
    if (fin.gananciaTienda !== undefined) update.gananciaTienda = fin.gananciaTienda;

    const newComision = fin.comisionVendedor !== undefined ? fin.comisionVendedor : oldComision;

    // Add audit entry
    await db.collection(config.collections.auditLogs).add({
      action: 'sale_edited_after_approval',
      orderId: req.params.id,
      reason: editReason,
      by: req.user.email,
      statusAtEdit: order.status,
      oldSaleTotal: order.saleTotal || 0,
      newSaleTotal: saleTotal,
      oldComision,
      newComision,
      at: FieldValue.serverTimestamp(),
    }).catch(() => {});

    // Si la venta YA ESTABA PAGADA, el dinero del vendedor ya salió. El lote de pago
    // no se toca: el descuadre se registra como ajuste de saldo (a favor o en contra)
    // que se saldará en su próximo pago. (Una venta sólo 'approved' aún no se ha pagado,
    // así que editarla no genera saldo.)
    if (order.status === 'paid') {
      await recordCommissionAdjustment({
        sellerEmail: update.sellerEmail || order.sellerEmail,
        sellerName: update.sellerName || order.sellerName,
        saleId: req.params.id,
        comisionVieja: oldComision,
        comisionNueva: newComision,
        reason: editReason,
        by: req.user.email,
      }).catch(() => {});
    }

    update.editReason = editReason;
  }
  if (req.body.sellerEmail) {
    update.sellerEmail = String(req.body.sellerEmail);
    update.sellerUid = req.body.sellerUid || '';
    update.sellerName = req.body.sellerName || String(req.body.sellerEmail).split('@')[0];
    update.type = 'admin_report';
  }
  // Fecha de la venta (YYYY-MM-DD) → createdAt a mediodía UTC (no cambia de día por zona horaria).
  if (req.body.saleDate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(req.body.saleDate));
    if (m) {
      update.createdAt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
      // Si la venta ya está aprobada/pagada, realinear la semana de pago a la nueva fecha
      // (de lo contrario la corrección de fecha queda agrupada en la semana vieja).
      if (order.status === 'approved' || order.status === 'paid') {
        update.weekOf = getISOWeekString(update.createdAt);
      }
    }
  }

  if (req.file) {
    const ext = (req.file.originalname.match(/\.[^.]+$/) || ['.png'])[0];
    update.receiptPhotoUrl = await storage.uploadFile(
      req.file.buffer,
      'receipts',
      `${Date.now()}_${req.params.id}${ext}`,
      req.file.mimetype
    );
  }

  await ref.update(update);
  res.json({ id: ref.id, ...order, ...update });
}));

// DELETE /api/sales/:id — elimina por completo una venta (admin). Requiere motivo.
// Pendiente → libera la reserva. Aprobada/Pagada → DEVUELVE el stock consumido.
// Rechazada → la reserva ya estaba liberada (no toca stock). Registra auditoría.
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ error: 'El motivo de eliminación es obligatorio.' });

  const ref = db.collection(ORDERS).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Venta no encontrada.' });
  const order = snap.data();
  const reservations = order.reservations || [];
  const origin = order.saleOrigin || 'native';

  if (order.status === 'pending_approval') {
    await releaseAny(origin, reservations);
  } else if ((order.status === 'approved' || order.status === 'paid') && reservations.length > 0) {
    if (origin === 'migrated') await restockApprovedMigrated(reservations);
    else await restockApprovedNative(reservations);
  }

  await db.collection(config.collections.auditLogs).add({
    action: 'sale_deleted',
    orderId: req.params.id,
    reason,
    by: req.user.email,
    statusAtDeletion: order.status,
    saleOrigin: origin,
    saleTotal: order.saleTotal || 0,
    sellerEmail: order.sellerEmail || null,
    at: FieldValue.serverTimestamp(),
  }).catch(() => {});

  await ref.delete();
  res.json({ ok: true });
}));

// POST /api/sales/:id/warranty — procesa cambio por garantía sobre una venta aprobada/pagada.
// Descuenta un nuevo ítem del inventario y registra la pérdida.
router.post('/:id/warranty', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(ORDERS).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Venta no encontrada.' });
  const order = snap.data();
  if (!['approved', 'paid'].includes(order.status)) {
    return res.status(400).json({ error: 'Solo se puede procesar garantía en ventas aprobadas o pagadas.' });
  }

  const { itemIndex, reason, notes } = req.body;
  const idx = parseInt(itemIndex, 10);
  if (isNaN(idx) || !order.items[idx]) {
    return res.status(400).json({ error: 'Ítem de la venta no válido.' });
  }
  if (!reason) return res.status(400).json({ error: 'El motivo es obligatorio.' });

  const item = order.items[idx];

  // Descontar 1 unidad del inventario FIFO (consume=true)
  let costReal = 0;
  try {
    costReal = await fifoForCode(item.code, 1, true);
  } catch (err) {
    return res.status(400).json({ error: `Sin stock para repuesto: ${err.message}` });
  }

  // Registrar como pérdida
  await db.collection(config.collections.losses).add({
    type: 'warranty',
    orderId: req.params.id,
    productCode: item.code,
    productName: item.name,
    quantity: 1,
    costReal,
    reason,
    notes: notes || '',
    processedBy: req.user.email,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Marcar el ítem como garantía procesada en la orden
  const updatedItems = order.items.map((it, i) =>
    i === idx ? { ...it, warrantyProcessed: true, warrantyReason: reason } : it
  );
  await ref.update({ items: updatedItems, updatedAt: FieldValue.serverTimestamp() });

  res.json({ ok: true, costReal });
}));

module.exports = router;
