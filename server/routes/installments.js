// Ventas en cuotas — solo el admin puede crear y registrar pagos.
// Flujo: admin crea la venta en cuotas → admin registra cada pago recibido
//        con fecha → sistema calcula saldo pendiente → cierra cuando saldo = 0.
const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { installmentSchema, installmentPaymentSchema } = require('../utils/validators');
const { reserveForItems, consumeReservation, fifoForCode } = require('../services/sales');
const { computeFinancials, getCostosFijosPct, round } = require('../services/commission');
const { RATE } = require('../services/inventory');

const INSTALLMENTS = config.collections.installments;

function badRequest(res, parsed) {
  return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Datos inválidos.' });
}

// GET /api/installments — todas las ventas en cuotas (activas y completadas).
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const snap = await db.collection(INSTALLMENTS).orderBy('createdAt', 'desc').get();
  const list = snap.docs.map((d) => {
    const o = d.data();
    return {
      id: d.id,
      customerName: o.customerName,
      customerPhone: o.customerPhone || '',
      sellerName: o.sellerName || '',
      sellerEmail: o.sellerEmail || '',
      items: o.items || [],
      totalAmount: o.totalAmount,
      numInstallments: o.numInstallments,
      installmentAmount: o.installmentAmount,
      amountPaid: o.amountPaid || 0,
      amountPending: o.amountPending ?? o.totalAmount,
      status: o.status,
      nextPaymentDate: o.nextPaymentDate || null,
      firstPaymentDate: o.firstPaymentDate,
      payments: o.payments || [],
      notes: o.notes || '',
      createdAt: o.createdAt?.toDate?.()?.toISOString() || null,
      completedAt: o.completedAt?.toDate?.()?.toISOString() || null,
    };
  });
  res.json(list);
}));

// GET /api/installments/pending — solo las que tienen saldo pendiente.
router.get('/pending', requireAdmin, asyncHandler(async (req, res) => {
  const snap = await db.collection(INSTALLMENTS).where('status', '==', 'active').get();
  const list = snap.docs
    .map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString() || null }))
    .sort((a, b) => String(a.nextPaymentDate || '').localeCompare(String(b.nextPaymentDate || '')));
  res.json(list);
}));

async function validatePriceFloor(items) {
  for (const item of items) {
    const lineCost = await fifoForCode(item.productId, item.quantity, false);
    const unitRealCost = lineCost / item.quantity;
    if (item.salePrice < unitRealCost * 1.15) {
      throw new Error("Ese monto no puede ingresarse porque está por debajo del coste real del producto y el margen mínimo permitido.");
    }
  }
}

// POST /api/installments — crea una venta en cuotas.
// Reserva el stock inmediatamente y lo consume al crear (comisión se paga completa).
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const parsed = installmentSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed);
  const data = parsed.data;

  // Validar Piso de Precio
  try {
    await validatePriceFloor(data.items);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Reservar y consumir stock FIFO al crear la cuota
  let reservations = [];
  try {
    reservations = await reserveForItems(data.items.map((it) => ({ code: it.productId, quantity: it.quantity })));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const realCostTotal = await consumeReservation(reservations);

  const costByCode = {};
  for (const r of reservations) {
    costByCode[r.code] = (costByCode[r.code] || 0) + r.unitFinalUsd * RATE * r.quantity;
  }
  for (const it of data.items) {
    it.lineCost = costByCode[it.productId] || 0;
  }
  const financials = computeFinancials({ lines: data.items });

  const doc = {
    customerName: data.customerName,
    customerPhone: data.customerPhone || '',
    sellerEmail: data.sellerEmail || '',
    sellerName: data.sellerName || '',
    sellerUid: data.sellerUid || '',
    items: data.items,
    totalAmount: data.totalAmount,
    numInstallments: data.numInstallments,
    installmentAmount: data.installmentAmount,
    amountPaid: 0,
    amountPending: data.totalAmount,
    status: 'active',
    firstPaymentDate: data.firstPaymentDate,
    nextPaymentDate: data.firstPaymentDate,
    notes: data.notes || '',
    payments: [],
    financials,
    createdAt: FieldValue.serverTimestamp(),
    completedAt: null,
  };

  const ref = await db.collection(INSTALLMENTS).add(doc);
  res.status(201).json({ id: ref.id, ...doc });
}));

// POST /api/installments/:id/payments — registra un pago de cuota.
router.post('/:id/payments', requireAdmin, asyncHandler(async (req, res) => {
  const parsed = installmentPaymentSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed);
  const { amount, paymentDate, nextPaymentDate, paymentMethod, notes } = parsed.data;

  const ref = db.collection(INSTALLMENTS).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Venta en cuotas no encontrada.' });
  const installment = snap.data();
  if (installment.status === 'completed') {
    return res.status(400).json({ error: 'Esta venta ya fue completamente pagada.' });
  }

  const newAmountPaid = round((installment.amountPaid || 0) + amount);
  const newAmountPending = round(installment.totalAmount - newAmountPaid);
  const isCompleted = newAmountPending <= 0;

  const payment = {
    amount,
    paymentDate,
    paymentMethod: paymentMethod || 'efectivo',
    notes: notes || '',
    registeredBy: req.user.email,
    createdAt: new Date().toISOString(),
  };

  const update = {
    amountPaid: newAmountPaid,
    amountPending: Math.max(0, newAmountPending),
    payments: FieldValue.arrayUnion(payment),
    status: isCompleted ? 'completed' : 'active',
    nextPaymentDate: isCompleted ? null : (nextPaymentDate || null),
    completedAt: isCompleted ? FieldValue.serverTimestamp() : null,
  };

  await ref.update(update);
  res.json({ ok: true, amountPaid: newAmountPaid, amountPending: Math.max(0, newAmountPending), completed: isCompleted });
}));

// DELETE /api/installments/:id — cancela una venta en cuotas (solo si no tiene pagos).
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(INSTALLMENTS).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Venta en cuotas no encontrada.' });
  const data = snap.data();
  if ((data.payments || []).length > 0) {
    return res.status(400).json({ error: 'No se puede cancelar una venta con pagos registrados.' });
  }
  await ref.delete();
  res.json({ ok: true });
}));

module.exports = router;
