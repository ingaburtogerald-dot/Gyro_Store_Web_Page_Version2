// Lógica de facturación: número de ticket secuencial por día y cálculo de totales.
const { db } = require('../firebase');
const config = require('../config');

// Genera el siguiente número de ticket del día: GS-DDMMYY-N (N secuencial).
// Contador transaccional en counters/invoices-YYYYMMDD: dos requests simultáneos
// nunca obtienen el mismo número (el conteo por rango de string sí tenía esa carrera).
async function nextTicketNumber() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const yy = yyyy.slice(-2);
  
  const dateStr = `${dd}${mm}${yy}`; // DDMMYY
  const counterKey = `invoices-global-sequence`; // Contador global para que no se reinicie cada día

  return db.runTransaction(async (tx) => {
    const ref = db.collection(config.collections.counters).doc(counterKey);
    const seq = ((await tx.get(ref)).data()?.seq || 0) + 1;
    tx.set(ref, { seq }, { merge: true });
    return `GS-${dateStr}-${seq}`;
  });
}

// Normaliza las líneas y calcula totales. discount es un monto en C$.
function computeTotals(items, discount = 0) {
  const lines = (items || []).map((it) => {
    const quantity = Math.max(1, parseInt(it.quantity, 10) || 1);
    const unitPrice = Math.max(0, parseFloat(it.unitPrice) || 0);
    return {
      productId: String(it.productId || ''),
      productCode: String(it.productCode || ''),
      productName: String(it.productName || ''),
      quantity,
      unitPrice,
      lineTotal: quantity * unitPrice,
    };
  });
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const disc = Math.max(0, Math.min(parseFloat(discount) || 0, subtotal));
  return { lines, subtotal, discount: disc, total: subtotal - disc };
}

module.exports = { nextTicketNumber, computeTotals };
