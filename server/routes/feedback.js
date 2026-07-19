// Feedback público (bugs, ideas, pedidos de producto). El envío es público y
// fire-and-forget con el correo (igual que contact.js); la lectura/gestión es solo admin.
const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAdmin } = require('../middleware/auth');
const { feedbackSchema } = require('../utils/validators');
const { sendFeedbackEmail } = require('../services/email');
const logger = require('../utils/logger');

const COL = config.collections.feedback;
const LIST_LIMIT = 100;
const VALID_STATUS = ['new', 'resolved'];

const iso = (ts) => ts?.toDate?.()?.toISOString() || null;

// Whitelist explícita: nunca hacemos spread ciego de lo que hay en Firestore.
function serializeFeedback(id, d) {
  return {
    id,
    type: d.type,
    message: d.message,
    userPhone: d.userPhone || null,
    status: d.status || 'new',
    createdAt: iso(d.createdAt),
  };
}

// POST /api/feedback — público.
router.post('/', asyncHandler(async (req, res) => {
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Datos inválidos.' });
  }
  const { type, message, userPhone } = parsed.data;

  const ref = await db.collection(COL).add({
    type,
    message,
    userPhone: userPhone || null,
    status: 'new',
    createdAt: FieldValue.serverTimestamp(),
  });

  // Fire-and-forget: el envío del correo nunca debe bloquear ni romper la respuesta.
  sendFeedbackEmail({ type, message, userPhone }).catch((err) => {
    logger.error('feedback_email_failed', { message: err.message });
  });

  res.json({ ok: true, id: ref.id });
}));

// GET /api/feedback — solo admin. Últimos 100, más reciente primero.
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const snap = await db.collection(COL).orderBy('createdAt', 'desc').limit(LIST_LIMIT).get();
  res.json(snap.docs.map((d) => serializeFeedback(d.id, d.data())));
}));

// PATCH /api/feedback/:id — solo admin. Cambia el status (ej. 'new' → 'resolved').
router.patch('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const status = String(req.body?.status ?? '');
  if (!VALID_STATUS.includes(status)) {
    return res.status(400).json({ error: `status debe ser: ${VALID_STATUS.join(' | ')}.` });
  }
  await db.collection(COL).doc(req.params.id).update({ status });
  res.json({ ok: true });
}));

module.exports = router;
