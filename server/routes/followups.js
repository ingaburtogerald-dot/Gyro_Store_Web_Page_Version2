// CRM de seguimientos de clientes. Admin ve todos; el vendedor solo los suyos.
const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireSeller } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { followupSchema } = require('../utils/validators');

const FOLLOWUPS = config.collections.followups;
const isAdminLike = (u) => u.roles.includes('admin') || u.roles.includes('global_admin');

function badRequest(res, parsed) {
  return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Datos inválidos.' });
}

function serialize(id, f) {
  return {
    id,
    ...f,
    createdAt: f.createdAt?.toDate?.()?.toISOString() || null,
    updatedAt: f.updatedAt?.toDate?.()?.toISOString() || null,
  };
}

// Carga un seguimiento y valida propiedad (vendedor solo los suyos).
async function loadOwned(req, res) {
  const ref = db.collection(FOLLOWUPS).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: 'Seguimiento no encontrado.' });
    return null;
  }
  const f = snap.data();
  if (!isAdminLike(req.user) && f.ownerEmail !== req.user.email) {
    res.status(403).json({ error: 'No puedes modificar seguimientos de otro usuario.' });
    return null;
  }
  return { ref, f };
}

// GET /api/followups — admin: todos; vendedor: los suyos. Orden por fecha de follow-up.
router.get('/', requireSeller, asyncHandler(async (req, res) => {
  const snap = isAdminLike(req.user)
    ? await db.collection(FOLLOWUPS).get()
    : await db.collection(FOLLOWUPS).where('ownerEmail', '==', req.user.email).get();
  const list = snap.docs.map((d) => serialize(d.id, d.data()));
  list.sort((a, b) => String(a.followUpDate || '').localeCompare(String(b.followUpDate || '')));
  res.json(list);
}));

// POST /api/followups — crea un seguimiento (queda a nombre del usuario).
router.post('/', requireSeller, asyncHandler(async (req, res) => {
  const parsed = followupSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed);
  const doc = {
    ...parsed.data,
    ownerUid: req.user.uid,
    ownerEmail: req.user.email,
    ownerName: req.user.name || req.user.email.split('@')[0],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection(FOLLOWUPS).add(doc);
  res.status(201).json(serialize(ref.id, doc));
}));

// PUT /api/followups/:id — edita (dueño o admin).
router.put('/:id', requireSeller, asyncHandler(async (req, res) => {
  const owned = await loadOwned(req, res);
  if (!owned) return;
  const parsed = followupSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed);
  const update = { ...parsed.data, updatedAt: FieldValue.serverTimestamp() };
  await owned.ref.update(update);
  res.json(serialize(req.params.id, { ...owned.f, ...update }));
}));

// PATCH /api/followups/:id/status — marca hecho / perdido / pendiente.
router.patch('/:id/status', requireSeller, asyncHandler(async (req, res) => {
  const owned = await loadOwned(req, res);
  if (!owned) return;
  const status = req.body?.status;
  if (!['pending', 'done', 'lost'].includes(status)) {
    return res.status(400).json({ error: 'Estado inválido.' });
  }
  await owned.ref.update({ status, updatedAt: FieldValue.serverTimestamp() });
  res.json({ ok: true });
}));

// DELETE /api/followups/:id — elimina (dueño o admin).
router.delete('/:id', requireSeller, asyncHandler(async (req, res) => {
  const owned = await loadOwned(req, res);
  if (!owned) return;
  await owned.ref.delete();
  res.json({ ok: true });
}));

module.exports = router;
