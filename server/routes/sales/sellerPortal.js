// Portal del vendedor: resumen mensual, estado de su dinero y su historial de pagos.
// Nunca expone datos financieros confidenciales de la tienda.
const router = require('express').Router();
const { db } = require('../../firebase');
const config = require('../../config');
const { requireSeller } = require('../../middleware/auth');
const { asyncHandler } = require('../../utils/asyncHandler');
const { computeFinancials, getCostosFijosPct, round } = require('../../services/commission');
const { realCostForItems, fifoForCode } = require('../../services/sales');
const { getPendingBalance } = require('../../services/balance');
const { ORDERS, migratedFinancialsFromLines } = require('./helpers');

// GET /api/sales/my-summary — resumen mensual del vendedor.
router.get('/my-summary', requireSeller, asyncHandler(async (req, res) => {
  const snap = await db.collection(ORDERS).where('sellerEmail', '==', req.user.email).get();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let ventasAprobadasCount = 0;
  let totalVendidoAmount = 0;
  let comisionGanadaAmount = 0;
  let enRevisionCount = 0;

  snap.docs.forEach((d) => {
    const o = d.data();
    const createdDate = o.createdAt?.toDate?.() || null;
    if (!createdDate) return;

    if (createdDate.getFullYear() === currentYear && createdDate.getMonth() === currentMonth) {
      if (o.status === 'approved' || o.status === 'paid') {
        ventasAprobadasCount++;
        totalVendidoAmount += o.saleTotal || o.totalSaleAmount || 0;
        comisionGanadaAmount += o.comisionVendedor || 0;
      } else if (o.status === 'pending_approval') {
        enRevisionCount++;
      }
    }
  });

  res.json({
    ventasAprobadas: ventasAprobadasCount,
    totalVendido: totalVendidoAmount,
    comisionGanada: comisionGanadaAmount,
    enRevision: enRevisionCount,
  });
}));

// GET /api/sales/my-balance — estado del dinero del vendedor (lo que verá arriba en su portal).
// Comisión por cobrar (ventas aprobadas no pagadas), saldo a favor/contra (ajustes) y el
// próximo pago estimado. No expone datos financieros confidenciales de la tienda.
router.get('/my-balance', requireSeller, asyncHandler(async (req, res) => {
  const snap = await db.collection(ORDERS).where('sellerEmail', '==', req.user.email).get();

  let comisionPorCobrar = 0;
  let ventasPorCobrar = 0;
  snap.docs.forEach((d) => {
    const o = d.data();
    if (o.status === 'approved') {
      comisionPorCobrar += o.comisionVendedor || 0;
      ventasPorCobrar++;
    }
  });

  // Comisión ESTIMADA de las ventas aún EN REVISIÓN (no aprobadas). La comisión real
  // se fija al aprobar; aquí la estimamos igual que la vista de admin (sin exponer
  // costo). Si una venta tiene stock insuficiente u otro problema, no suma.
  let comisionPendiente = 0;
  let ventasPendientes = 0;
  for (const d of snap.docs) {
    const o = d.data();
    if (o.status !== 'pending_approval') continue;
    ventasPendientes++;
    try {
      let est;
      if (o.saleOrigin === 'migrated') {
        est = migratedFinancialsFromLines(o.items, o.saleTotal);
      } else {
        const lines = o.items || [];
        for (const it of lines) {
          it.lineCost = await fifoForCode(it.code, it.quantity, false);
        }
        est = computeFinancials({ lines });
      }
      comisionPendiente += est.comisionVendedor || 0;
    } catch {
      /* venta no estimable (p. ej. stock insuficiente): se omite de la estimación */
    }
  }

  const { balance: saldo } = await getPendingBalance(req.user.email);
  const proximoPago = Math.max(0, round(comisionPorCobrar + saldo));

  res.json({
    comisionPorCobrar: round(comisionPorCobrar),
    ventasPorCobrar,
    comisionPendiente: round(comisionPendiente),
    ventasPendientes,
    saldo: round(saldo),
    proximoPago,
  });
}));

// GET /api/sales/my-payments — historial de pagos recibidos por el vendedor (sus lotes).
router.get('/my-payments', requireSeller, asyncHandler(async (req, res) => {
  const snap = await db.collection(config.collections.payments)
    .where('sellerEmail', '==', req.user.email)
    .get();

  const list = snap.docs.map((d) => {
    const p = d.data();
    return {
      id: d.id,
      totalComision: p.totalComision || 0,
      saldoAplicado: p.saldoAplicado || 0,
      isSettlement: p.isSettlement === true,
      ventasCount: Array.isArray(p.saleIds) ? p.saleIds.length : 0,
      saleIds: Array.isArray(p.saleIds) ? p.saleIds : [],
      paymentMethod: p.paymentMethod || 'cash',
      receiptUrl: p.receiptUrl || null,
      noReceiptComment: p.noReceiptComment || null,
      createdAt: p.createdAt?.toDate?.()?.toISOString() || null,
      createdBy: p.createdBy || 'Sistema',
    };
  });

  // Orden descendente por fecha (en memoria para evitar índice compuesto en Firestore).
  list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  res.json(list);
}));

module.exports = router;
