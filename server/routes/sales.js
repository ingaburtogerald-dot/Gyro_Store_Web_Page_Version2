// Gestión de Ventas. El cotizador y la aprobación comparten la misma fórmula
// (services/commission) y el mismo FIFO (services/sales). Los totales y la
// comisión SIEMPRE se calculan en el servidor.
const router = require('express').Router();
const multer = require('multer');
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireSeller, requireAdmin, requireAnyRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { computeFinancials, computeMigratedFinancials, getCostosFijosPct, round } = require('../services/commission');
const {
  fifoForCode, realCostForItems, reserveForItems, releaseReservation, consumeReservation,
  reserveForMigratedItems, releaseMigratedReservation, consumeMigratedReservation,
  restockApprovedNative, restockApprovedMigrated,
} = require('../services/sales');
const { RATE } = require('../services/inventory');
const {
  recordCommissionAdjustment, getPendingBalance, getAllPendingBalances, settleAdjustments,
} = require('../services/balance');
const storage = require('../services/storage');
const email = require('../services/email');

const ORDERS = config.collections.orders;
const PRODUCTS = config.collections.products;
const MIGRATED = config.collections.migratedInventory;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const isAdminLike = (u) => u.roles.includes('admin') || u.roles.includes('global_admin');

// Quita campos de costo/utilidad confidenciales de las líneas antes de responder a
// un no-admin (el vendedor nunca debe ver costo real ni utilidades de la tienda).
function publicItems(items) {
  return (items || []).map((it) => {
    const { unitCostReal, costReal, utilidadBruta, costosFijos, utilidadNeta, ...rest } = it;
    return rest;
  });
}

function getISOWeekString(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const weekPad = String(weekNo).padStart(2, '0');
  return `${d.getUTCFullYear()}-W${weekPad}`;
}

// Resuelve cada ítem contra products (nativo) o migrated_inventory (migrado).
// Devuelve líneas confiables + saleTotal + saleOrigin. Una venta NO puede mezclar
// inventario actual y migrado (regla de negocio).
async function buildLines(items) {
  const lines = [];
  let saleTotal = 0;
  let hasNative = false, hasMigrated = false;

  for (const it of items || []) {
    const productId = String(it.productId || '');
    const quantity = Math.max(1, parseInt(it.quantity, 10) || 1);
    const salePrice = Math.max(0, parseFloat(it.salePrice) || 0);
    if (!productId) continue;

    if (it.origin === 'migrated') {
      const doc = await db.collection(MIGRATED).doc(productId).get();
      if (!doc.exists) continue;
      const m = doc.data();
      const lineTotal = salePrice * quantity;
      const unitCostReal = ((Number(m.costUnit) || 0) + (Number(m.shippingUnit) || 0)) * RATE;
      if (salePrice < unitCostReal) {
        throw new Error(`El precio ingresado para el producto migrado "${m.productName}" (C$${salePrice}) no puede estar por debajo de su coste real (C$${Math.round(unitCostReal)}).`);
      }
      saleTotal += lineTotal;
      hasMigrated = true;
      lines.push({
        productId: doc.id,
        migratedId: doc.id,
        origin: 'migrated',
        mode: it.mode === 'M2' ? 'M2' : 'M1',
        code: m.code,
        name: m.productName,
        variantName: 'Migrado',
        quantity,
        salePrice,
        lineTotal,
        unitCostReal,
      });
    } else {
      const doc = await db.collection(PRODUCTS).doc(productId).get();
      if (!doc.exists) continue;
      const p = doc.data();
      const lineTotal = salePrice * quantity;
      saleTotal += lineTotal;
      hasNative = true;
      lines.push({
        productId: doc.id,
        origin: 'native',
        code: p.code,
        name: p.name,
        variantName: String(it.variantName || 'Estándar'),
        quantity,
        salePrice,
        lineTotal,
      });
    }
  }

  if (hasNative && hasMigrated) {
    throw new Error('Una venta no puede mezclar inventario actual y migrado. Regístralas por separado.');
  }
  return { lines, saleTotal, saleOrigin: hasMigrated ? 'migrated' : 'native' };
}

// Financieros estimados de una venta migrada a partir de sus líneas ya resueltas.
function migratedFinancialsFromLines(lines, saleTotal) {
  return computeMigratedFinancials({
    lines: lines.map((l) => ({
      lineTotal: l.salePrice * l.quantity,
      lineCost: (Number(l.unitCostReal) || 0) * l.quantity,
      mode: l.mode,
    })),
    saleTotal,
  });
}

async function validatePriceFloor(lines) {
  for (const line of lines) {
    const lineCost = await fifoForCode(line.code, line.quantity, false);
    const unitRealCost = lineCost / line.quantity;
    if (line.salePrice < unitRealCost * 1.15) {
      throw new Error("Ese monto no puede ingresarse porque está por debajo del coste real del producto y el margen mínimo permitido.");
    }
  }
}

// GET /api/sales/products — productos vendibles (stock > 0) para el cotizador.
// Incluye AMBOS inventarios: nativo (origin:'native') y migrado (origin:'migrated').
router.get('/products', requireSeller, asyncHandler(async (req, res) => {
  const snap = await db.collection(PRODUCTS).get();
  const native = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => !p.deletedAt && (p.stock || 0) > 0)
    .map((p) => ({ id: p.id, code: p.code, name: p.name, price: p.price || 0, stock: p.stock || 0, origin: 'native' }));

  const migSnap = await db.collection(MIGRATED).get();
  const migrated = migSnap.docs
    .map((d) => {
      const m = d.data();
      const stock = Math.max(0, (m.quantity || 0) - (m.quantitySold || 0) - (m.quantityReserved || 0));
      const costReal = ((Number(m.costUnit) || 0) + (Number(m.shippingUnit) || 0)) * RATE;
      const price = Math.round((costReal * 1.40) / 10) * 10; // sugerido migrado (+40%)
      return { id: d.id, code: m.code, name: m.productName, price, stock, origin: 'migrated' };
    })
    .filter((p) => p.stock > 0);

  res.json([...native, ...migrated].sort((a, b) => String(a.name).localeCompare(String(b.name))));
}));

// POST /api/sales/quote — cotizador en tiempo real (no persiste, no consume stock).
router.post('/quote', requireSeller, asyncHandler(async (req, res) => {
  let built;
  try {
    built = await buildLines(req.body.items);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const { lines, saleTotal, saleOrigin } = built;
  if (!lines.length) return res.status(400).json({ error: 'Selecciona al menos un producto.' });

  try {
    let full;
    if (saleOrigin === 'migrated') {
      // Migrado: costo ya conocido, sin FIFO ni costos fijos (lógica M1/M2 por línea).
      full = { saleTotal, saleOrigin, costosFijosPct: 0, ...migratedFinancialsFromLines(lines, saleTotal) };
    } else {
      await validatePriceFloor(lines);
      const realCost = await realCostForItems(lines.map((l) => ({ code: l.code, quantity: l.quantity })), false);
      const pct = await getCostosFijosPct();
      full = { saleTotal, saleOrigin: 'native', costosFijosPct: pct, ...computeFinancials({ saleTotal, realCost, costosFijosPct: pct }) };
    }
    // El vendedor solo ve el total y su comisión; el desglose de costo/utilidad es confidencial.
    if (!isAdminLike(req.user)) {
      return res.json({ saleTotal: full.saleTotal, saleOrigin: full.saleOrigin, comisionVendedor: full.comisionVendedor });
    }
    res.json(full);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

// POST /api/sales/report — registra una venta (pendiente de aprobación), con foto opcional.
router.post('/report', requireSeller, upload.single('receipt'), asyncHandler(async (req, res) => {
  let items;
  try {
    items = typeof req.body.items === 'string' ? JSON.parse(req.body.items) : req.body.items;
  } catch {
    return res.status(400).json({ error: 'Datos de la venta inválidos.' });
  }

  const { lines, saleTotal } = await buildLines(items);
  if (!lines.length) return res.status(400).json({ error: 'La venta no tiene productos válidos.' });

  try {
    await validatePriceFloor(lines);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  let receiptPhotoUrl = '';
  if (req.file) {
    const slug = storage.sanitizePathSegment(req.user.name || req.user.email.split('@')[0]);
    const ext = (req.file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0];
    receiptPhotoUrl = await storage.uploadFile(req.file.buffer, `sales-receipts/${slug}`, `${Date.now()}${ext}`, req.file.mimetype);
  }

  let reservations = [];
  try {
    reservations = await reserveForItems(lines.map((l) => ({ code: l.code, quantity: l.quantity })));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const order = {
    type: 'seller_report',
    sellerUid: req.user.uid,
    sellerEmail: req.user.email,
    sellerName: req.user.name || req.user.email.split('@')[0],
    registeredBy: req.user.uid,
    items: lines,
    saleTotal,
    totalSaleAmount: saleTotal,
    status: 'pending_approval',
    receiptPhotoUrl,
    reservations,
    rejectionReason: null,
    invoiceId: null,
    paymentScreenshotUrl: null,
    createdAt: FieldValue.serverTimestamp(),
    approvedAt: null,
    paidAt: null,
    weekOf: null,
  };

  if (req.body.saleDate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(req.body.saleDate));
    if (m) {
      order.createdAt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
    }
  }

  const ref = await db.collection(ORDERS).add(order);
  // No filtrar costos de las líneas migradas al vendedor que registra la venta.
  const responseItems = isAdminLike(req.user) ? order.items : publicItems(order.items);
  res.status(201).json({ id: ref.id, ...order, items: responseItems });
}));

// POST /api/sales — registra una venta (seller, admin), con foto opcional y admin register on behalf.
router.post('/', requireSeller, upload.single('receipt'), asyncHandler(async (req, res) => {
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

  // Validación de piso de precio: solo para inventario nativo (el migrado tiene reglas propias).
  if (saleOrigin === 'native') {
    try {
      await validatePriceFloor(lines);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  } else {
    // Migrado: rechaza de una vez modos no soportados (p. ej. M2).
    try {
      migratedFinancialsFromLines(lines, saleTotal);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  let receiptPhotoUrl = '';
  if (req.file) {
    const slug = storage.sanitizePathSegment(req.user.name || req.user.email.split('@')[0]);
    const ext = (req.file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0];
    receiptPhotoUrl = await storage.uploadFile(req.file.buffer, `sales-receipts/${slug}`, `${Date.now()}${ext}`, req.file.mimetype);
  }

  let sellerUid = req.user.uid;
  let sellerEmail = req.user.email;
  let sellerName = req.user.name || req.user.email.split('@')[0];
  let type = 'seller_report';

  const isUserAdmin = isAdminLike(req.user);
  if (isUserAdmin && req.body.sellerEmail) {
    sellerEmail = req.body.sellerEmail;
    sellerUid = req.body.sellerUid || '';
    sellerName = req.body.sellerName || sellerEmail.split('@')[0];
    type = 'admin_report';
  }

  // Reservar stock: FIFO (nativo) o sobre el lote migrado.
  let reservations = [];
  try {
    reservations = saleOrigin === 'migrated'
      ? await reserveForMigratedItems(lines.map((l) => ({ migratedId: l.migratedId, quantity: l.quantity })))
      : await reserveForItems(lines.map((l) => ({ code: l.code, quantity: l.quantity })));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const order = {
    type,
    saleOrigin,
    sellerUid,
    sellerEmail,
    sellerName,
    registeredBy: req.user.uid,
    items: lines,
    saleTotal,
    totalSaleAmount: saleTotal,
    status: 'pending_approval',
    receiptPhotoUrl,
    reservations,
    rejectionReason: null,
    invoiceId: null,
    paymentScreenshotUrl: null,
    createdAt: FieldValue.serverTimestamp(),
    approvedAt: null,
    paidAt: null,
    weekOf: null,
  };

  if (req.body.saleDate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(req.body.saleDate));
    if (m) {
      order.createdAt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
    }
  }

  const ref = await db.collection(ORDERS).add(order);
  // No filtrar costos de las líneas migradas al vendedor que registra la venta.
  const responseItems = isAdminLike(req.user) ? order.items : publicItems(order.items);
  res.status(201).json({ id: ref.id, ...order, items: responseItems });
}));

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
  const pct = await getCostosFijosPct();
  for (const d of snap.docs) {
    const o = d.data();
    if (o.status !== 'pending_approval') continue;
    ventasPendientes++;
    try {
      const est = o.saleOrigin === 'migrated'
        ? migratedFinancialsFromLines(o.items, o.saleTotal)
        : computeFinancials({
            saleTotal: o.saleTotal,
            realCost: await realCostForItems((o.items || []).map((l) => ({ code: l.code, quantity: l.quantity })), false),
            costosFijosPct: pct,
          });
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
    receiptUrl = await storage.uploadFile(req.file.buffer, 'payments', `${Date.now()}_settle_${sellerEmail}${ext}`, req.file.mimetype);
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

// GET /api/sales — obtiene las ventas (filtra por usuario según rol, y soporta paginación)
router.get('/', requireAnyRole, asyncHandler(async (req, res) => {
  const isUserAdmin = isAdminLike(req.user);
  let docs;

  // Filtro de base de datos rápido
  if (req.query.ids) {
    const ids = String(req.query.ids).split(',').filter(Boolean);
    if (ids.length > 0) {
      const refs = ids.map(id => db.collection(ORDERS).doc(id));
      const snaps = await db.getAll(...refs);
      docs = snaps.filter(s => s.exists);
    } else {
      docs = [];
    }
  } else if (isUserAdmin) {
    if (req.query.sellerEmail && req.query.sellerEmail !== 'all') {
      docs = (await db.collection(ORDERS).where('sellerEmail', '==', req.query.sellerEmail).get()).docs;
    } else {
      docs = (await db.collection(ORDERS).where('type', 'in', ['seller_report', 'admin_report']).get()).docs;
    }
  } else {
    docs = (await db.collection(ORDERS).where('sellerEmail', '==', req.user.email).get()).docs;
  }

  // Mapear a objetos planos reteniendo Timestamp para filtros
  let rawList = docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  // Filtro de fecha en memoria (compatible con YYYY-MM y YYYY-MM-DD)
  if (req.query.date && req.query.date !== 'all') {
    const dateStr = String(req.query.date);
    rawList = rawList.filter(o => {
      const iso = o.createdAt?.toDate?.()?.toISOString() || '';
      return iso.startsWith(dateStr);
    });
  }

  // Filtro de estado en memoria
  if (req.query.status && req.query.status !== 'all') {
    if (req.query.status === 'history') {
      rawList = rawList.filter(o => o.status === 'approved' || o.status === 'paid');
    } else {
      rawList = rawList.filter(o => o.status === req.query.status);
    }
  }

  // Ordenamiento en memoria por fecha (descendente)
  rawList.sort((a, b) => {
    const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
    const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
    return bTime - aTime;
  });

  // Aplicar paginación si se solicita
  const paginate = req.query.paginate === 'true';
  const total = rawList.length;
  let slicedList = rawList;
  let page = 1;
  let limit = 50;

  if (paginate) {
    page = Math.max(1, parseInt(req.query.page, 10) || 1);
    limit = Math.max(1, Math.min(100000, parseInt(req.query.limit, 10) || 50));
    slicedList = rawList.slice((page - 1) * limit, page * limit);
  }

  const list = [];
  const pct = isUserAdmin ? await getCostosFijosPct() : 0;

  // Procesar únicamente los ítems de la página actual (Optimización N+1)
  for (const o of slicedList) {
    const sanitized = {
      ...o,
      createdAt: o.createdAt?.toDate?.()?.toISOString() || null,
      approvedAt: o.approvedAt?.toDate?.()?.toISOString() || null,
      paidAt: o.paidAt?.toDate?.()?.toISOString() || null,
    };

    if (isUserAdmin && sanitized.status === 'pending_approval' && sanitized.saleOrigin === 'migrated') {
      // Migrado: financieros estimados desde el costo ya guardado en cada línea (sin FIFO).
      try {
        const est = migratedFinancialsFromLines(sanitized.items, sanitized.saleTotal);
        sanitized.totalCostReal = est.costReal;
        sanitized.totalUtilidadBruta = est.utilidadBruta;
        sanitized.totalCostosFijos = est.costosFijos;
        sanitized.totalUtilidadNeta = est.utilidadNeta;
        sanitized.comisionVendedor = est.comisionVendedor;
        sanitized.comisionPercent = est.comisionPercent;
        sanitized.gananciaTienda = est.gananciaTienda;
        sanitized.items = sanitized.items.map((it) => {
          const c = (Number(it.unitCostReal) || 0) * it.quantity;
          const ub = it.salePrice * it.quantity - c;
          return { ...it, costReal: round(c), utilidadBruta: round(ub), costosFijos: 0, utilidadNeta: round(ub) };
        });
      } catch (err) {
        sanitized.insufficientStockError = err.message;
      }
    } else if (isUserAdmin && sanitized.status === 'pending_approval') {
      try {
        const tempCost = await realCostForItems(sanitized.items.map((l) => ({ code: l.code, quantity: l.quantity })), false);
        const est = computeFinancials({ saleTotal: sanitized.saleTotal, realCost: tempCost, costosFijosPct: pct });

        sanitized.totalCostReal = est.costReal;
        sanitized.totalUtilidadBruta = est.utilidadBruta;
        sanitized.totalCostosFijos = est.costosFijos;
        sanitized.totalUtilidadNeta = est.utilidadNeta;
        sanitized.comisionVendedor = est.comisionVendedor;
        sanitized.comisionPercent = est.comisionPercent;
        sanitized.gananciaTienda = est.gananciaTienda;

        // Rellenar costos de los items de forma estimada para la visualización del admin
        const updatedItems = [];
        for (const it of sanitized.items) {
          const itemCostReal = await fifoForCode(it.code, it.quantity, false);
          const itemSaleTotal = it.salePrice * it.quantity;
          const itemUtilidadBruta = itemSaleTotal - itemCostReal;
          const itemCostosFijos = itemUtilidadBruta * (est.costosFijosPct / 100);
          const itemUtilidadNeta = itemUtilidadBruta - itemCostosFijos;

          updatedItems.push({
            ...it,
            costReal: round(itemCostReal),
            utilidadBruta: round(itemUtilidadBruta),
            costosFijos: round(itemCostosFijos),
            utilidadNeta: round(itemUtilidadNeta),
          });
        }
        sanitized.items = updatedItems;
      } catch (err) {
        sanitized.insufficientStockError = err.message;
      }
    } else if (!isUserAdmin) {
      // Excluir campos financieros confidenciales
      delete sanitized.totalCostReal;
      delete sanitized.totalUtilidadBruta;
      delete sanitized.totalCostosFijos;
      delete sanitized.totalUtilidadNeta;
      delete sanitized.gananciaTienda;

      if (Array.isArray(sanitized.items)) {
        sanitized.items = sanitized.items.map((it) => {
          const copy = { ...it };
          delete copy.costReal;
          delete copy.utilidadBruta;
          delete copy.costosFijos;
          delete copy.utilidadNeta;
          delete copy.unitCostReal; // costo unitario migrado: confidencial
          return copy;
        });
      }
    }

    list.push(sanitized);
  }

  if (paginate) {
    let totalVendidoAmount = 0;
    let totalComisionAmount = 0;
    let totalGananciaTienda = 0;
    let totalInversionRecuperada = 0;
    let totalVentasAprobadas = 0;
    let totalVentasEnRevision = 0;

    for (const o of rawList) {
      if (o.status === 'approved' || o.status === 'paid') {
        totalVentasAprobadas++;
        totalVendidoAmount += o.saleTotal || 0;
        totalComisionAmount += o.comisionVendedor || 0;
        totalGananciaTienda += o.gananciaTienda || 0;
        totalInversionRecuperada += o.costReal || o.totalCostReal || 0;
      } else if (o.status === 'pending_approval') {
        totalVentasEnRevision++;
      }
    }

    res.json({
      data: list,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        ventasAprobadas: totalVentasAprobadas,
        totalVendido: totalVendidoAmount,
        comisiones: totalComisionAmount,
        // Ganancia de tienda e inversión/costo son confidenciales: solo admin.
        gananciaTienda: isUserAdmin ? totalGananciaTienda : 0,
        inversionRecuperada: isUserAdmin ? totalInversionRecuperada : 0,
        enRevision: totalVentasEnRevision
      }
    });
  } else {
    res.json(list);
  }
}));

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
    // Migrado: consume del lote migrado (mueve "Salidas") y calcula M1 (sin costos fijos).
    await consumeMigratedReservation(reservations);
    fin = migratedFinancialsFromLines(order.items, order.saleTotal);
    for (const it of order.items) {
      const itemCostReal = (Number(it.unitCostReal) || 0) * it.quantity;
      const itemUtilidadBruta = it.salePrice * it.quantity - itemCostReal;
      updatedItems.push({
        ...it,
        costReal: round(itemCostReal),
        utilidadBruta: round(itemUtilidadBruta),
        costosFijos: 0,
        utilidadNeta: round(itemUtilidadBruta),
      });
    }
  } else {
    const pct = await getCostosFijosPct();
    let totalCostReal = 0;

    if (reservations.length > 0) {
      totalCostReal = await consumeReservation(reservations);
    } else {
      // Compatibilidad con órdenes sin reservas (registradas antes de este cambio)
      try {
        for (const it of order.items) await fifoForCode(it.code, it.quantity, false);
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
      for (const it of order.items) {
        const itemCostReal = await fifoForCode(it.code, it.quantity, true);
        totalCostReal += itemCostReal;
      }
    }

    // 3. Totales globales de la orden (para la tasa dinámica de costos fijos)
    fin = computeFinancials({ saleTotal: order.saleTotal, realCost: totalCostReal, costosFijosPct: pct });
    const itemPct = fin.costosFijosPct;

    // Desglose de costos por ítem
    if (reservations.length > 0) {
      const costByCode = {};
      for (const r of reservations) {
        costByCode[r.code] = (costByCode[r.code] || 0) + r.unitFinalUsd * RATE * r.quantity;
      }
      for (const it of order.items) {
        const itemCostReal = costByCode[it.code] || 0;
        const itemSaleTotal = it.salePrice * it.quantity;
        const itemUtilidadBruta = itemSaleTotal - itemCostReal;
        const itemCostosFijos = itemUtilidadBruta * (itemPct / 100);
        const itemUtilidadNeta = itemUtilidadBruta - itemCostosFijos;
        updatedItems.push({
          ...it,
          costReal: round(itemCostReal),
          utilidadBruta: round(itemUtilidadBruta),
          costosFijos: round(itemCostosFijos),
          utilidadNeta: round(itemUtilidadNeta),
        });
      }
    } else {
      for (const it of order.items) {
        const itemCostReal = await fifoForCode(it.code, it.quantity, false);
        const itemSaleTotal = it.salePrice * it.quantity;
        const itemUtilidadBruta = itemSaleTotal - itemCostReal;
        const itemCostosFijos = itemUtilidadBruta * (itemPct / 100);
        const itemUtilidadNeta = itemUtilidadBruta - itemCostosFijos;
        updatedItems.push({
          ...it,
          costReal: round(itemCostReal),
          utilidadBruta: round(itemUtilidadBruta),
          costosFijos: round(itemCostosFijos),
          utilidadNeta: round(itemUtilidadNeta),
        });
      }
    }
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
  const sales = [];
  for (const id of saleIds) {
    const snap = await db.collection(ORDERS).doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: `Venta ${id} no encontrada.` });
    const order = snap.data();
    if (order.status !== 'pending_approval') {
      return res.status(400).json({ error: `La venta ${id} ya no está pendiente.` });
    }
    sales.push({ id, ...order });
  }

  const sellerEmail = sales[0].sellerEmail;
  const sellerName = sales[0].sellerName;
  if (sales.some((s) => s.sellerEmail !== sellerEmail)) {
    return res.status(400).json({ error: 'Todas las ventas seleccionadas deben ser del mismo vendedor.' });
  }

  // 2. Procesar aprobación para cada una
  let totalComision = 0;
  for (const order of sales) {
    const reservations = order.reservations || [];
    const updatedItems = [];
    let fin;

    if (order.saleOrigin === 'migrated') {
      await consumeMigratedReservation(reservations);
      fin = migratedFinancialsFromLines(order.items, order.saleTotal);
      for (const it of order.items) {
        const itemCostReal = (Number(it.unitCostReal) || 0) * it.quantity;
        const itemUtilidadBruta = it.salePrice * it.quantity - itemCostReal;
        updatedItems.push({
          ...it,
          costReal: round(itemCostReal),
          utilidadBruta: round(itemUtilidadBruta),
          costosFijos: 0,
          utilidadNeta: round(itemUtilidadBruta),
        });
      }
    } else {
      const pct = await getCostosFijosPct();
      let totalCostReal = 0;
      if (reservations.length > 0) {
        totalCostReal = await consumeReservation(reservations);
      } else {
        try {
          for (const it of order.items) await fifoForCode(it.code, it.quantity, false);
        } catch (err) {
          return res.status(400).json({ error: err.message });
        }
        for (const it of order.items) {
          totalCostReal += await fifoForCode(it.code, it.quantity, true);
        }
      }
      fin = computeFinancials({ saleTotal: order.saleTotal, realCost: totalCostReal, costosFijosPct: pct });
      const itemPct = fin.costosFijosPct;
      if (reservations.length > 0) {
        const costByCode = {};
        for (const r of reservations) {
          costByCode[r.code] = (costByCode[r.code] || 0) + r.unitFinalUsd * RATE * r.quantity;
        }
        for (const it of order.items) {
          const itemCostReal = costByCode[it.code] || 0;
          const itemUtilidadBruta = it.salePrice * it.quantity - itemCostReal;
          const itemCostosFijos = itemUtilidadBruta * (itemPct / 100);
          updatedItems.push({
            ...it,
            costReal: round(itemCostReal),
            utilidadBruta: round(itemUtilidadBruta),
            costosFijos: round(itemCostosFijos),
            utilidadNeta: round(itemUtilidadBruta - itemCostosFijos),
          });
        }
      } else {
        const globalRatio = totalCostReal > 0 && order.saleTotal > 0 ? totalCostReal / order.saleTotal : 0;
        for (const it of order.items) {
          const itemCostReal = it.salePrice * it.quantity * globalRatio;
          const itemUtilidadBruta = it.salePrice * it.quantity - itemCostReal;
          const itemCostosFijos = itemUtilidadBruta * (itemPct / 100);
          updatedItems.push({
            ...it,
            costReal: round(itemCostReal),
            utilidadBruta: round(itemUtilidadBruta),
            costosFijos: round(itemCostosFijos),
            utilidadNeta: round(itemUtilidadBruta - itemCostosFijos),
          });
        }
      }
    }

    totalComision += fin.comisionVendedor;

    const approvedDate = baseDate;
    const weekOf = getISOWeekString(approvedDate);
    const updatePayload = {
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
    };
    await db.collection(ORDERS).doc(order.id).update(updatePayload);
  }

  // 3. Subir comprobante a Storage si se proporcionó
  let receiptUrl = null;
  if (req.file) {
    const ext = (req.file.originalname.match(/\.[^.]+$/) || ['.png'])[0];
    receiptUrl = await storage.uploadFile(
      req.file.buffer,
      'payments',
      `${Date.now()}_${sellerEmail}${ext}`,
      req.file.mimetype
    );
  }

  // 3.5. Aplicar el saldo pendiente del vendedor (ajustes por ediciones de ventas pagadas).
  //   saldoAplicado > 0 → la tienda le debía: se suma al pago.
  //   saldoAplicado < 0 → recibió de más: se descuenta del pago.
  const grossComision = round(totalComision);
  const { balance: saldoAplicado, adjustments: pendingAdjustments } = await getPendingBalance(sellerEmail);
  const netToPay = round(grossComision + saldoAplicado);
  const totalPagado = Math.max(0, netToPay);

  // 4. Ver tipo de usuario para notificar
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

  // 5. Crear lote de pago
  const paymentRef = await db.collection(config.collections.payments).add(paymentRecord);

  // 5.5. Saldar los ajustes aplicados. Si el saldo en contra superó la comisión del
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

// Helper: libera reservas según el origen de la venta.
async function releaseAny(saleOrigin, reservations) {
  if (!reservations || reservations.length === 0) return;
  if (saleOrigin === 'migrated') await releaseMigratedReservation(reservations).catch(() => {});
  else await releaseReservation(reservations).catch(() => {});
}

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
      update.items = lines.map((it) => {
        const itemCostReal = (Number(it.unitCostReal) || 0) * it.quantity;
        const itemUtilidadBruta = it.salePrice * it.quantity - itemCostReal;
        return {
          ...it,
          costReal: round(itemCostReal),
          utilidadBruta: round(itemUtilidadBruta),
          costosFijos: 0,
          utilidadNeta: round(itemUtilidadBruta),
        };
      });
    } else {
      const pct = await getCostosFijosPct();
      let totalCostReal = await consumeReservation(reservations);
      fin = computeFinancials({ saleTotal, realCost: totalCostReal, costosFijosPct: pct });
      const costByCode = {};
      for (const r of reservations) {
        costByCode[r.code] = (costByCode[r.code] || 0) + r.unitFinalUsd * RATE * r.quantity;
      }
      update.items = lines.map((it) => {
        const itemCostReal = costByCode[it.code] || 0;
        const itemUtilidadBruta = it.salePrice * it.quantity - itemCostReal;
        const itemCostosFijos = itemUtilidadBruta * (fin.costosFijosPct / 100);
        return {
          ...it,
          costReal: round(itemCostReal),
          utilidadBruta: round(itemUtilidadBruta),
          costosFijos: round(itemCostosFijos),
          utilidadNeta: round(itemUtilidadBruta - itemCostosFijos),
        };
      });
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

// GET /api/sales/weekly-summary — ventas aprobadas agrupadas por vendedor/semana.
router.get('/weekly-summary', requireAdmin, asyncHandler(async (req, res) => {
  const snap = await db.collection(ORDERS)
    .where('type', 'in', ['seller_report', 'admin_report'])
    .where('status', '==', 'approved')
    .get();

  const groups = {};

  snap.docs.forEach((doc) => {
    const o = doc.data();
    const week = o.weekOf || 'Sin Semana';
    const emailStr = o.sellerEmail || 'desconocido@gyrostore.com';
    const key = `${week}_${emailStr}`;

    if (!groups[key]) {
      groups[key] = {
        weekOf: week,
        sellerEmail: emailStr,
        sellerName: o.sellerName || emailStr.split('@')[0],
        sales: [],
        totalVendido: 0,
        comisionTotal: 0,
        ventasAprobadasCount: 0,
      };
    }

    groups[key].sales.push({
      id: doc.id,
      saleTotal: o.saleTotal || o.totalSaleAmount || 0,
      comisionVendedor: o.comisionVendedor || 0,
      items: o.items || [],
      createdAt: o.createdAt?.toDate?.()?.toISOString() || null,
    });

    groups[key].totalVendido += o.saleTotal || o.totalSaleAmount || 0;
    groups[key].comisionTotal += o.comisionVendedor || 0;
    groups[key].ventasAprobadasCount++;
  });

  const list = Object.values(groups).map((g) => {
    g.totalVendido = Math.round(g.totalVendido * 100) / 100;
    g.comisionTotal = Math.round(g.comisionTotal * 100) / 100;
    g.sales.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    return g;
  });

  list.sort((a, b) => b.weekOf.localeCompare(a.weekOf));
  res.json(list);
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
    paymentScreenshotUrl = await storage.uploadFile(req.file.buffer, 'payment-screenshots', `${Date.now()}${ext}`, req.file.mimetype);
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
    paymentScreenshotUrl = await storage.uploadFile(req.file.buffer, 'payment-screenshots', `${Date.now()}${ext}`, req.file.mimetype);
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

// GET /api/sales/performance — comparativa por vendedor (admin y seller).
router.get('/performance', requireSeller, asyncHandler(async (req, res) => {
  const { year, month, allTime } = req.query;
  let q = db.collection(ORDERS).where('status', '==', 'approved');

  if (allTime !== 'true') {
    const d = new Date();
    const y = year ? Number(year) : d.getFullYear();
    const m = month !== undefined ? Number(month) : d.getMonth();
    const start = new Date(Date.UTC(y, m, 1, 0, 0, 0));
    const end = new Date(Date.UTC(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1, 1, 0, 0, 0));
    q = q.where('createdAt', '>=', start).where('createdAt', '<', end);
  }

  const snap = await q.get();
  const map = {};
  let companyTotalSales = 0;

  snap.forEach((doc) => {
    const d = doc.data();
    const email = d.sellerEmail;
    if (!map[email]) {
      map[email] = {
        sellerEmail: email,
        sellerName: d.sellerName,
        ventas: 0,
        totalVendido: 0,
        comisiones: 0,
      };
    }
    map[email].ventas += 1;
    map[email].totalVendido += d.saleTotal || 0;
    map[email].comisiones += d.comisionVendedor || 0;
    
    companyTotalSales += d.saleTotal || 0;
  });

  let results = Object.values(map).map((s) => ({
    ...s,
    comisionPromedio: s.ventas ? s.comisiones / s.ventas : 0,
  }));

  // Ordenar de mayor a menor totalVendido
  results.sort((a, b) => b.totalVendido - a.totalVendido);

  if (req.user.role !== 'admin') {
    results = results.filter((s) => s.sellerEmail === req.user.email);
    res.json({ data: results, companyTotalSales });
    return;
  }

  res.json({ data: results, companyTotalSales });
}));

// GET /api/sales/timeseries — serie temporal de ventas para el dashboard (Resumen).
// Granularidad y ventana derivadas del filtro `date` (relleno de ceros sin huecos):
//   - 'all'        → desde la 1ª venta hasta hoy, agrupado por MES (cap 24 meses)
//   - 'YYYY-MM'    → ese mes completo, agrupado por DÍA
//   - 'YYYY-MM-DD' → ese único día (1 punto)
// Solo cuenta ventas approved|paid. ventas = Σ saleTotal, ganancia = Σ gananciaTienda.
// Usa el MISMO acceso a datos que GET '/' (query simple + agregación en memoria) para
// no exigir índices compuestos nuevos; el dataset del negocio es chico.
router.get('/timeseries', requireAnyRole, asyncHandler(async (req, res) => {
  const isUserAdmin = isAdminLike(req.user);
  const sellerEmail = req.query.sellerEmail;
  const dateStr = req.query.date && req.query.date !== 'all' ? String(req.query.date) : null;

  // Granularidad + ventana [start, end) en UTC.
  let granularity = 'day';
  let start, end;
  // Sin filtro: vista por mes desde la PRIMERA venta hasta hoy (start se calcula
  // tras leer los datos, para no arrastrar meses vacíos previos al primer registro).
  const allTime = !dateStr;
  if (allTime) {
    granularity = 'month';
    const now = new Date();
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  } else if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const [y, m] = dateStr.split('-').map(Number);
    start = new Date(Date.UTC(y, m - 1, 1));
    end = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1));
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    start = new Date(Date.UTC(y, m - 1, d));
    end = new Date(Date.UTC(y, m - 1, d + 1));
  } else {
    return res.status(400).json({ error: 'Parámetro date inválido.' });
  }

  // Acceso a datos: idéntico a GET '/' (sin índices compuestos).
  let docs;
  if (isUserAdmin) {
    if (sellerEmail && sellerEmail !== 'all') {
      docs = (await db.collection(ORDERS).where('sellerEmail', '==', sellerEmail).get()).docs;
    } else {
      docs = (await db.collection(ORDERS).where('type', 'in', ['seller_report', 'admin_report']).get()).docs;
    }
  } else {
    docs = (await db.collection(ORDERS).where('sellerEmail', '==', req.user.email).get()).docs;
  }

  // Vista "todo el tiempo": el inicio es el mes de la primera venta aprobada/pagada
  // (cap de 24 meses para no generar un eje X gigante). Sin ventas → solo el mes actual.
  if (allTime) {
    let earliest = null;
    for (const doc of docs) {
      const o = doc.data();
      if (o.status !== 'approved' && o.status !== 'paid') continue;
      const created = o.createdAt?.toDate?.();
      if (created && created < end && (!earliest || created < earliest)) earliest = created;
    }
    start = earliest
      ? new Date(Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth(), 1))
      : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
    const cap = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 24, 1));
    if (start < cap) start = cap;
  }

  // Acumular en buckets (clave por mes YYYY-MM o por día YYYY-MM-DD), solo
  // aprobadas/pagadas dentro de la ventana.
  const sliceLen = granularity === 'month' ? 7 : 10;
  const buckets = new Map();
  for (const doc of docs) {
    const o = doc.data();
    if (o.status !== 'approved' && o.status !== 'paid') continue;
    const created = o.createdAt?.toDate?.();
    if (!created || created < start || created >= end) continue;
    const key = created.toISOString().slice(0, sliceLen);
    const acc = buckets.get(key) || { ventas: 0, ganancia: 0, comision: 0 };
    acc.ventas += o.saleTotal || 0;
    acc.comision += o.comisionVendedor || 0; // comisión del vendedor (no confidencial)
    acc.ganancia += isUserAdmin ? (o.gananciaTienda || 0) : 0; // ganancia tienda: confidencial
    buckets.set(key, acc);
  }

  // Relleno continuo de ceros entre start y end (serie sin huecos para el chart).
  const data = [];
  const cursor = new Date(start);
  while (cursor < end) {
    const key = cursor.toISOString().slice(0, sliceLen);
    const acc = buckets.get(key) || { ventas: 0, ganancia: 0, comision: 0 };
    // Siempre devolvemos `date` como YYYY-MM-DD (el primer día del bucket).
    data.push({ date: `${key}${granularity === 'month' ? '-01' : ''}`, ventas: round(acc.ventas), comision: round(acc.comision), ganancia: round(acc.ganancia) });
    if (granularity === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  res.json({ data, granularity, isMock: false });
}));

module.exports = router;
