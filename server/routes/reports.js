// Reportería: dashboard de KPIs + gráficos, y registro de pérdidas.
const router = require('express').Router();
const { z } = require('zod');
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { buildReport } = require('../services/reports');
const { fifoForCode, reserveForMigratedItems, consumeMigratedReservation } = require('../services/sales');

const PURCHASES = config.collections.purchases;
const ORDERS = config.collections.orders;
const LOSSES = config.collections.losses;
const MIGRATED = config.collections.migratedInventory;
const PRODUCTS = config.collections.products;

const EXPENSE_GROUP_KEYS = config.expenseGroups.map((g) => g.key);

const iso = (ts) => ts?.toDate?.()?.toISOString() || null;

// GET /api/reports?year=&month=
//   month: 0-11 para un mes; omitido / 'all' / vacío → TODO el año.
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getFullYear();
  const mRaw = req.query.month;
  const month = mRaw == null || mRaw === '' || mRaw === 'all' ? null : Number(mRaw);

  const [purSnap, salesSnap, migSnap, lossSnap] = await Promise.all([
    db.collection(PURCHASES).get(),
    // Incluye ventas de vendedor Y registradas por admin (las migradas entran aquí).
    db.collection(ORDERS).where('type', 'in', ['seller_report', 'admin_report']).get(),
    db.collection(MIGRATED).get(),
    db.collection(LOSSES).get(),
  ]);

  const purchases = purSnap.docs.map((d) => d.data());
  const sales = salesSnap.docs.map((d) => ({ ...d.data(), createdAt: iso(d.data().createdAt) }));
  const migrated = migSnap.docs.map((d) => d.data());
  const losses = lossSnap.docs.map((d) => d.data());

  res.json(buildReport({ purchases, sales, migrated, losses, year, month }));
}));

// GET /api/reports/losses — historial de pérdidas.
router.get('/losses', requireAdmin, asyncHandler(async (req, res) => {
  const snap = await db.collection(LOSSES).get();
  const list = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
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
const lossSchema = z.object({
  date: z.string().min(1, 'Fecha requerida'),
  productId: z.string().min(1, 'Producto requerido'),
  origin: z.enum(['native', 'migrated']).default('native'),
  quantity: z.coerce.number().int().positive('Cantidad inválida'),
  category: z.enum(['robo', 'daño', 'devolucion']),
  reason: z.string().max(200).optional().default(''),
});

// POST /api/reports/losses — registra una pérdida de inventario y descuenta stock.
router.post('/losses', requireAdmin, asyncHandler(async (req, res) => {
  const parsed = lossSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Datos inválidos.' });
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
  res.status(201).json({ id: ref.id, ...doc, createdAt: null });
}));

// ── Gastos operativos: monto + grupo (con pozo) + subcategoría libre ──
const expenseSchema = z.object({
  date: z.string().min(1, 'Fecha requerida'),
  amount: z.coerce.number().positive('Monto inválido'),
  currency: z.enum(['C$', 'USD']).default('C$'),
  group: z.string().refine((g) => EXPENSE_GROUP_KEYS.includes(g), 'Grupo inválido'),
  subcategory: z.string().max(60).optional().default(''),
  reason: z.string().max(200).optional().default(''),
});

// POST /api/reports/expenses — registra un gasto operativo.
router.post('/expenses', requireAdmin, asyncHandler(async (req, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Datos inválidos.' });

  const doc = {
    kind: 'expense',
    ...parsed.data,
    subcategory: (parsed.data.subcategory || '').trim(),
    registeredBy: req.user.email,
    createdAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection(LOSSES).add(doc);
  res.status(201).json({ id: ref.id, ...doc, createdAt: null });
}));

module.exports = router;
