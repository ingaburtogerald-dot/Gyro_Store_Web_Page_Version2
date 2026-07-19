// Códigos de descuento (admin los crea, ej. incentivo por reseña en Google/Facebook).
// El código en MAYÚSCULAS es el id del doc en Firestore → unicidad gratis, sin
// query extra para chequear duplicados.
//
// Dos caminos de lectura, a propósito distintos:
//   · checkDiscountCode()  → SOLO lee, no consume uso. Usado por POST /validate
//     (preview instantáneo en el checkout) — el cliente puede llamarlo las veces
//     que quiera sin gastar el cupo del código.
//   · redeemDiscountCode() → revalida TODO de nuevo y descuenta un uso, dentro de
//     una transacción de Firestore (evita que dos pedidos concurrentes agoten un
//     código de 1 uso). Se llama SOLO desde POST /api/orders/public (orders.js),
//     atómico con la creación del pedido — nunca se confía en el preview del cliente.
const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAdmin } = require('../middleware/auth');
const { discountCodeSchema } = require('../utils/validators');

const COL = config.collections.discountCodes;
const LIST_LIMIT = 200;

function normalizeCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
}

const iso = (ts) => ts?.toDate?.()?.toISOString() || null;

function serialize(doc) {
  const d = doc.data();
  return {
    code: doc.id,
    type: d.type,
    value: d.value,
    maxUses: d.maxUses ?? 0,
    usedCount: d.usedCount ?? 0,
    active: d.active !== false,
    expiresAt: d.expiresAt || null,
    note: d.note || '',
    createdAt: iso(d.createdAt),
    createdBy: d.createdBy || '',
  };
}

// GET /api/discount-codes — solo admin.
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const snap = await db.collection(COL).orderBy('createdAt', 'desc').limit(LIST_LIMIT).get();
  res.json(snap.docs.map(serialize));
}));

// POST /api/discount-codes — solo admin. Crea un código nuevo.
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const parsed = discountCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Datos inválidos.' });
  }
  const data = parsed.data;
  const code = normalizeCode(data.code);
  if (!code) return res.status(400).json({ error: 'Código inválido.' });

  const ref = db.collection(COL).doc(code);
  const existing = await ref.get();
  if (existing.exists) return res.status(409).json({ error: `El código "${code}" ya existe.` });

  await ref.set({
    type: data.type,
    value: data.value,
    maxUses: data.maxUses,
    usedCount: 0,
    active: true,
    expiresAt: data.expiresAt || null,
    note: data.note,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: req.user?.email || '',
  });

  const doc = await ref.get();
  res.status(201).json(serialize(doc));
}));

// PATCH /api/discount-codes/:code — solo admin. Hoy solo activar/desactivar
// (mantenerlo simple: reemitir un código es más seguro que editar uno ya repartido).
router.patch('/:code', requireAdmin, asyncHandler(async (req, res) => {
  const code = normalizeCode(req.params.code);
  const ref = db.collection(COL).doc(code);
  const doc = await ref.get();
  if (!doc.exists) return res.status(404).json({ error: 'Código no encontrado.' });

  if (typeof req.body?.active !== 'boolean') {
    return res.status(400).json({ error: 'Falta el campo "active".' });
  }
  await ref.update({ active: req.body.active });
  res.json({ ok: true });
}));

// Preview de solo lectura: valida sin descontar un uso.
async function checkDiscountCode(rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, error: null }; // sin código: no es un error, simplemente no hay descuento
  const doc = await db.collection(COL).doc(code).get();
  if (!doc.exists) return { ok: false, error: 'Código inválido.' };
  const d = doc.data();
  if (d.active === false) return { ok: false, error: 'Este código ya no está activo.' };
  if (d.expiresAt && new Date(d.expiresAt).getTime() < Date.now()) return { ok: false, error: 'Este código venció.' };
  if (d.maxUses > 0 && (d.usedCount || 0) >= d.maxUses) return { ok: false, error: 'Este código alcanzó su límite de usos.' };
  return { ok: true, code, type: d.type, value: d.value };
}

// Canje real: revalida todo de nuevo DENTRO de una transacción y descuenta un uso.
async function redeemDiscountCode(rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, error: null };
  const ref = db.collection(COL).doc(code);
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) return { ok: false, error: 'Código inválido.' };
    const d = doc.data();
    if (d.active === false) return { ok: false, error: 'Este código ya no está activo.' };
    if (d.expiresAt && new Date(d.expiresAt).getTime() < Date.now()) return { ok: false, error: 'Este código venció.' };
    if (d.maxUses > 0 && (d.usedCount || 0) >= d.maxUses) return { ok: false, error: 'Este código alcanzó su límite de usos.' };
    tx.update(ref, { usedCount: FieldValue.increment(1) });
    return { ok: true, code, type: d.type, value: d.value };
  });
}

// POST /api/discount-codes/validate — público. Preview, no consume uso.
router.post('/validate', asyncHandler(async (req, res) => {
  const result = await checkDiscountCode(req.body?.code);
  if (!result.ok) return res.status(400).json({ error: result.error || 'Código inválido.' });
  res.json({ ok: true, code: result.code, type: result.type, value: result.value });
}));

module.exports = router;
module.exports.redeemDiscountCode = redeemDiscountCode;
