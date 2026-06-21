// Cuenta corriente del vendedor. Cuando se edita una venta YA PAGADA su comisión
// cambia, pero el lote de pago histórico (colección payments) es inmutable. La
// diferencia se registra aquí como un "ajuste" y se salda en el próximo pago.
//   delta > 0 → saldo A FAVOR del vendedor (la tienda le debe).
//   delta < 0 → saldo EN CONTRA del vendedor (recibió de más; debe devolver).
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { round } = require('./commission');

const ADJ = config.collections.commissionAdjustments;

// Registra un ajuste de comisión por edición de una venta pagada.
// Devuelve el ajuste creado, o null si el delta redondeado es 0.
async function recordCommissionAdjustment({ sellerEmail, sellerName, saleId, comisionVieja, comisionNueva, reason, by }) {
  const delta = round((Number(comisionNueva) || 0) - (Number(comisionVieja) || 0));
  if (delta === 0) return null;

  const adj = {
    sellerEmail,
    sellerName: sellerName || sellerEmail.split('@')[0],
    saleId: saleId || null,
    comisionVieja: round(Number(comisionVieja) || 0),
    comisionNueva: round(Number(comisionNueva) || 0),
    delta,
    reason: reason || '',
    by: by || null,
    settled: false,
    settledPaymentId: null,
    createdAt: FieldValue.serverTimestamp(),
    settledAt: null,
  };
  const ref = await db.collection(ADJ).add(adj);
  return { id: ref.id, ...adj };
}

// Saldo pendiente (no saldado) de un vendedor. Devuelve { balance, adjustments }.
// Se filtra por settled (campo único, sin índice compuesto) y luego por vendedor.
async function getPendingBalance(sellerEmail) {
  const snap = await db.collection(ADJ).where('settled', '==', false).get();
  let balance = 0;
  const adjustments = [];
  snap.docs.forEach((d) => {
    const a = d.data();
    if (a.sellerEmail !== sellerEmail) return;
    balance += a.delta || 0;
    adjustments.push({ id: d.id, ...a });
  });
  return { balance: round(balance), adjustments };
}

// Saldos pendientes de TODOS los vendedores con saldo distinto de 0.
// Devuelve { [sellerEmail]: { balance, sellerName, count } }.
async function getAllPendingBalances() {
  const snap = await db.collection(ADJ).where('settled', '==', false).get();
  const map = {};
  snap.docs.forEach((d) => {
    const a = d.data();
    if (!map[a.sellerEmail]) {
      map[a.sellerEmail] = { sellerEmail: a.sellerEmail, sellerName: a.sellerName || a.sellerEmail.split('@')[0], balance: 0, count: 0 };
    }
    map[a.sellerEmail].balance += a.delta || 0;
    map[a.sellerEmail].count += 1;
  });
  const out = {};
  for (const [email, v] of Object.entries(map)) {
    v.balance = round(v.balance);
    if (v.balance !== 0) out[email] = v;
  }
  return out;
}

// Marca un conjunto de ajustes como saldados por un pago.
async function settleAdjustments(adjustmentIds, paymentId) {
  if (!adjustmentIds || !adjustmentIds.length) return;
  const batch = db.batch();
  for (const id of adjustmentIds) {
    batch.update(db.collection(ADJ).doc(id), {
      settled: true,
      settledPaymentId: paymentId || null,
      settledAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}

module.exports = {
  recordCommissionAdjustment,
  getPendingBalance,
  getAllPendingBalances,
  settleAdjustments,
};
