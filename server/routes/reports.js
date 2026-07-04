// Reportería: dashboard de KPIs + gráficos, y registro de pérdidas.
const router = require('express').Router();
// Schemas compartidos con el frontend (fuente única: shared/schemas.mjs).
// require(esm) es nativo desde Node 20.19 (engines del package.json).
const { lossApiSchema, lossEditSchema, makeExpenseSchema } = require('../../shared/schemas.mjs');
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { zodBadRequest } = require('../utils/zodError');
const { buildReport } = require('../services/reports');
const { fifoForCode, reserveForMigratedItems, consumeMigratedReservation } = require('../services/sales');

const PURCHASES = config.collections.purchases;
const ORDERS = config.collections.orders;
const LOSSES = config.collections.losses;
const MIGRATED = config.collections.migratedInventory;
const PRODUCTS = config.collections.products;

const EXPENSE_GROUP_KEYS = config.expenseGroups.map((g) => g.key);

const iso = (ts) => ts?.toDate?.()?.toISOString() || null;

// Caché en memoria de los datos crudos por año (una sola instancia de Express).
// buildReport corre por petición sobre los datos cacheados, así cambiar de mes en
// el dashboard no cuesta lecturas. Las mutaciones de este router invalidan el
// caché; las aprobaciones de ventas (routes/sales.js) quedan cubiertas por el TTL.
const reportCache = new Map(); // year → { at, data: { purchases, sales, migrated, losses } }
const REPORT_CACHE_TTL = 60_000;
const invalidateReportCache = () => reportCache.clear();

// Lee de Firestore solo los documentos del año pedido (rangos, no colecciones
// completas). purchaseDate y losses.date son strings YYYY-MM-DD → el rango
// lexicográfico funciona; createdAt es Timestamp → rango con Date, ampliado un
// día por lado para cubrir el desfase de zona horaria (buildReport re-filtra
// con exactitud en memoria).
async function fetchYearData(year) {
  const yStart = `${year}-01-01`;
  const yEnd = `${year + 1}-01-01`;
  const tsStart = new Date(Date.UTC(year - 1, 11, 31));
  const tsEnd = new Date(Date.UTC(year + 1, 0, 2));

  const [purSnap, salesSnap, migSnap, lossSnap] = await Promise.all([
    db.collection(PURCHASES)
      .where('purchaseDate', '>=', yStart)
      .where('purchaseDate', '<', yEnd)
      .get(),
    // Solo rango de fechas en la query (evita el índice compuesto con `type`);
    // el filtro por tipo se aplica en memoria sobre el año ya acotado.
    db.collection(ORDERS)
      .where('createdAt', '>=', tsStart)
      .where('createdAt', '<', tsEnd)
      .get(),
    // Migrado: colección pequeña y estática, se lee completa.
    db.collection(MIGRATED).get(),
    db.collection(LOSSES)
      .where('date', '>=', yStart)
      .where('date', '<', yEnd)
      .get(),
  ]);

  return {
    purchases: purSnap.docs.map((d) => d.data()),
    // Incluye ventas de vendedor Y registradas por admin (las migradas entran aquí).
    sales: salesSnap.docs
      .map((d) => d.data())
      .filter((s) => s.type === 'seller_report' || s.type === 'admin_report')
      .map((s) => ({ ...s, createdAt: iso(s.createdAt) })),
    migrated: migSnap.docs.map((d) => d.data()),
    losses: lossSnap.docs.map((d) => d.data()),
  };
}

// GET /api/reports?year=&month=
//   month: 0-11 para un mes; omitido / 'all' / vacío → TODO el año.
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getFullYear();
  const mRaw = req.query.month;
  const month = mRaw == null || mRaw === '' || mRaw === 'all' ? null : Number(mRaw);

  let hit = reportCache.get(year);
  if (!hit || Date.now() - hit.at > REPORT_CACHE_TTL) {
    hit = { at: Date.now(), data: await fetchYearData(year) };
    reportCache.set(year, hit);
  }

  res.json(buildReport({ ...hit.data, year, month }));
}));

// GET /api/reports/losses — historial de pérdidas.
router.get('/losses', requireAdmin, asyncHandler(async (req, res) => {
  const year = Number(req.query.year);
  const mRaw = req.query.month;
  const month = mRaw == null || mRaw === '' || mRaw === 'all' ? null : Number(mRaw);

  // Con año: rango sobre el string YYYY-MM-DD (solo lee ese año de Firestore).
  let query = db.collection(LOSSES);
  if (year) {
    query = query
      .where('date', '>=', `${year}-01-01`)
      .where('date', '<', `${year + 1}-01-01`);
  }
  const snap = await query.get();
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (year && month !== null) {
    // req.query.month es 0-indexed. El string YYYY-MM es 1-indexed.
    list = list.filter((d) => Number((d.date || '').split('-')[1]) === month + 1);
  }

  list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  res.json(list);
}));

// GET /api/reports/products — productos con stock para el registro de pérdidas
// (nativo + migrado). Mismo criterio que el cotizador: solo lo que tiene stock.
router.get('/products', requireAdmin, asyncHandler(async (req, res) => {
  const [snap, migSnap] = await Promise.all([
    db.collection(PRODUCTS).get(),
    db.collection(MIGRATED).get(),
  ]);
  const native = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => !p.deletedAt && (p.stock || 0) > 0)
    .map((p) => ({ id: p.id, code: p.code, name: p.name, stock: p.stock || 0, origin: 'native' }));
  const migrated = migSnap.docs
    .map((d) => {
      const m = d.data();
      const stock = Math.max(0, (m.quantity || 0) - (m.quantitySold || 0) - (m.quantityReserved || 0));
      return { id: d.id, code: m.code, name: m.productName, stock, origin: 'migrated' };
    })
    .filter((p) => p.stock > 0);
  res.json([...native, ...migrated]);
}));

// GET /api/reports/expense-categories — grupos de gasto + subcategorías ya usadas
// (para el autocompletado). Las subcategorías se derivan del histórico.
router.get('/expense-categories', requireAdmin, asyncHandler(async (req, res) => {
  const snap = await db.collection(LOSSES).where('kind', '==', 'expense').get();
  const byGroup = {};
  for (const d of snap.docs) {
    const e = d.data();
    const sub = (e.subcategory || '').trim();
    if (!sub) continue;
    (byGroup[e.group] ||= new Set()).add(sub);
  }
  const subcategoriesByGroup = {};
  for (const [g, set] of Object.entries(byGroup)) subcategoriesByGroup[g] = [...set].sort();
  res.json({ groups: config.expenseGroups, subcategoriesByGroup });
}));

// ── Pérdidas de inventario: se elige un producto y su costo real es la pérdida ──
// (schema en shared/schemas.mjs: lossApiSchema)

// POST /api/reports/losses — registra una pérdida de inventario y descuenta stock.
router.post('/losses', requireAdmin, asyncHandler(async (req, res) => {
  const parsed = lossApiSchema.safeParse(req.body);
  if (!parsed.success) return zodBadRequest(res, parsed);
  const { date, productId, origin, quantity, category, reason } = parsed.data;

  // Resolver producto y consumir stock (mismo mecanismo que una venta).
  let productCode, productName, amount;
  try {
    if (origin === 'migrated') {
      const doc = await db.collection(MIGRATED).doc(productId).get();
      if (!doc.exists) return res.status(404).json({ error: 'Producto migrado no encontrado.' });
      productCode = doc.data().code;
      productName = doc.data().productName;
      const reservations = await reserveForMigratedItems([{ migratedId: productId, quantity }]);
      amount = await consumeMigratedReservation(reservations);
    } else {
      const doc = await db.collection(PRODUCTS).doc(productId).get();
      if (!doc.exists) return res.status(404).json({ error: 'Producto no encontrado.' });
      productCode = doc.data().code;
      productName = doc.data().name;
      amount = await fifoForCode(productCode, quantity, true);
    }
  } catch (err) {
    return res.status(400).json({ error: err.message || 'No se pudo descontar el stock.' });
  }

  const doc = {
    kind: 'inventory_loss',
    date, productId, origin, productCode, productName, quantity, category,
    reason: reason || '',
    amount: Math.round(amount),
    currency: 'C$',
    registeredBy: req.user.email,
    createdAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection(LOSSES).add(doc);
  invalidateReportCache();
  res.status(201).json({ id: ref.id, ...doc, createdAt: null });
}));

// PATCH /api/reports/losses/:id — edita los metadatos de una pérdida.
// Solo fecha, tipo y nota: producto y cantidad afectan stock/costo y no se editan
// (la pérdida no guarda los lotes FIFO consumidos, así que no es reversible con exactitud).
// (schema en shared/schemas.mjs: lossEditSchema)
router.patch('/losses/:id', requireAdmin, asyncHandler(async (req, res) => {
  const parsed = lossEditSchema.safeParse(req.body);
  if (!parsed.success) return zodBadRequest(res, parsed);

  const ref = db.collection(LOSSES).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists || snap.data().kind === 'expense') {
    return res.status(404).json({ error: 'Pérdida no encontrada.' });
  }

  const update = {
    ...parsed.data,
    reason: (parsed.data.reason || '').trim(),
    updatedBy: req.user.email,
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.update(update);
  invalidateReportCache();
  res.json({ id: ref.id, ...snap.data(), ...update, updatedAt: null });
}));

// ── Gastos operativos: monto + grupo (con pozo) + subcategoría libre ──
// Base compartida + grupos válidos del config del servidor.
const expenseSchema = makeExpenseSchema(EXPENSE_GROUP_KEYS);

// POST /api/reports/expenses — registra un gasto operativo.
router.post('/expenses', requireAdmin, asyncHandler(async (req, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) return zodBadRequest(res, parsed);

  const doc = {
    kind: 'expense',
    ...parsed.data,
    subcategory: (parsed.data.subcategory || '').trim(),
    registeredBy: req.user.email,
    createdAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection(LOSSES).add(doc);
  invalidateReportCache();
  res.status(201).json({ id: ref.id, ...doc, createdAt: null });
}));

// PATCH /api/reports/expenses/:id — edita un gasto operativo.
router.patch('/expenses/:id', requireAdmin, asyncHandler(async (req, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) return zodBadRequest(res, parsed);

  const ref = db.collection(LOSSES).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists || snap.data().kind !== 'expense') {
    return res.status(404).json({ error: 'Gasto no encontrado.' });
  }

  const update = {
    ...parsed.data,
    subcategory: (parsed.data.subcategory || '').trim(),
    updatedBy: req.user.email,
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.update(update);
  invalidateReportCache();
  res.json({ id: ref.id, kind: 'expense', ...update, updatedAt: null });
}));

module.exports = router;
