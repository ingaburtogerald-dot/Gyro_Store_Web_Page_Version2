// Reportería: dashboard de KPIs + gráficos, y registro de pérdidas.
const router = require('express').Router();
const { z } = require('zod');
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { buildReport } = require('../services/reports');

const PURCHASES = config.collections.purchases;
const ORDERS = config.collections.orders;
const LOSSES = config.collections.losses;
const MIGRATED = config.collections.migratedInventory;

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

const lossSchema = z.object({
  date: z.string().min(1, 'Fecha requerida'),
  amount: z.coerce.number().positive('Monto inválido'),
  currency: z.enum(['C$', 'USD']).default('C$'),
  reason: z.string().min(2, 'Motivo requerido').max(200),
  category: z.enum(['robo', 'daño', 'devolucion', 'otro']),
});

// POST /api/reports/losses — registra una pérdida.
router.post('/losses', requireAdmin, asyncHandler(async (req, res) => {
  const parsed = lossSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Datos inválidos.' });

  const doc = {
    ...parsed.data,
    registeredBy: req.user.email,
    createdAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection(LOSSES).add(doc);
  res.status(201).json({ id: ref.id, ...doc });
}));

module.exports = router;
