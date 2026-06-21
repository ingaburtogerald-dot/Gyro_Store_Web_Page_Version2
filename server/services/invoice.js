// Lógica de facturación: número de ticket secuencial por día y cálculo de totales.
const { db } = require('../firebase');
const config = require('../config');

const INVOICES = config.collections.invoices;

// Genera el siguiente número de ticket del día: GS-YYYYMMDD-NNN (NNN secuencial).
async function nextTicketNumber() {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const prefix = `GS-${ymd}-`;
  // Límite superior del rango de prefijo (carácter alto de Unicode usado por Firestore).
  const upper = prefix + String.fromCharCode(0xf8ff);

  // Cuenta los tickets de hoy mediante un rango de string (sin índice compuesto).
  const snap = await db
    .collection(INVOICES)
    .where('ticketNumber', '>=', prefix)
    .where('ticketNumber', '<', upper)
    .get();

  const seq = String(snap.size + 1).padStart(3, '0');
  return `${prefix}${seq}`;
}

// Normaliza las líneas y calcula totales. discount es un monto en C$.
function computeTotals(items, discount = 0) {
  const lines = (items || []).map((it) => {
    const quantity = Math.max(1, parseInt(it.quantity, 10) || 1);
    const unitPrice = Math.max(0, parseFloat(it.unitPrice) || 0);
    return {
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
