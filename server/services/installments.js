const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { installmentSchema, installmentPaymentSchema } = require('../utils/validators');
const { reserveForItems, consumeReservation, fifoForCode } = require('./sales');
const { computeFinancials, round } = require('./commission');
const { RATE } = require('./inventory');

const INSTALLMENTS = config.collections.installments;

async function validatePriceFloor(items) {
  for (const item of items) {
    const lineCost = await fifoForCode(item.productId, item.quantity, false);
    const unitRealCost = lineCost / item.quantity;
    if (item.salePrice < unitRealCost * 1.15) {
      throw new Error("Ese monto no puede ingresarse porque está por debajo del coste real del producto y el margen mínimo permitido.");
    }
  }
}

async function getAllInstallments() {
  const snap = await db.collection(INSTALLMENTS).orderBy('createdAt', 'desc').get();
  return snap.docs.map((d) => {
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
}

async function getPendingInstallments() {
  const snap = await db.collection(INSTALLMENTS).where('status', '==', 'active').get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString() || null }))
    .sort((a, b) => String(a.nextPaymentDate || '').localeCompare(String(b.nextPaymentDate || '')));
}

async function createInstallment(body) {
  const parsed = installmentSchema.safeParse(body);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message || 'Datos inválidos.');
  const data = parsed.data;

  await validatePriceFloor(data.items);

  let reservations = await reserveForItems(data.items.map((it) => ({ code: it.productId, quantity: it.quantity })));
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
  return { id: ref.id, ...doc };
}

async function registerPayment(id, body, userEmail) {
  const parsed = installmentPaymentSchema.safeParse(body);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message || 'Datos inválidos.');
  const { amount, paymentDate, nextPaymentDate, paymentMethod, notes } = parsed.data;

  const ref = db.collection(INSTALLMENTS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Venta en cuotas no encontrada.');
  
  const installment = snap.data();
  if (installment.status === 'completed') {
    throw new Error('Esta venta ya fue completamente pagada.');
  }

  const newAmountPaid = round((installment.amountPaid || 0) + amount);
  const newAmountPending = round(installment.totalAmount - newAmountPaid);
  const isCompleted = newAmountPending <= 0;

  const payment = {
    amount,
    paymentDate,
    paymentMethod: paymentMethod || 'efectivo',
    notes: notes || '',
    registeredBy: userEmail,
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
  return { amountPaid: newAmountPaid, amountPending: Math.max(0, newAmountPending), completed: isCompleted };
}

async function cancelInstallment(id) {
  const ref = db.collection(INSTALLMENTS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Venta en cuotas no encontrada.');
  const data = snap.data();
  if ((data.payments || []).length > 0) {
    throw new Error('No se puede cancelar una venta con pagos registrados.');
  }
  await ref.delete();
}

module.exports = {
  getAllInstallments,
  getPendingInstallments,
  createInstallment,
  registerPayment,
  cancelInstallment
};
