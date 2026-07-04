// Seguimientos (CRM ligero): contactos + historial de actividades.
//   - `contacts/{id}`            → la persona (activo/cerrado + próximo recordatorio).
//   - `contacts/{id}/activities` → subcolección con cada interacción (el historial).
// Admin/global_admin ven todos; el vendedor solo los suyos (validado en el server).
// Consultas de igualdad simple + orden/filtrado en memoria: NO requiere índices
// compuestos (a la escala de una tienda, es más simple y barato).
const router = require('express').Router();
const { db, FieldValue, Timestamp } = require('../firebase');
const config = require('../config');
const { requireSeller } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { crmContactSchema, crmActivitySchema, CONTACT_STATUS } = require('../utils/validators');

const CONTACTS = config.collections.contacts;
const MAX = 500; // techo de seguridad; a esta escala se carga todo y se procesa en memoria
const isAdminLike = (u) => u.roles.includes('admin') || u.roles.includes('global_admin');

function badRequest(res, parsed) {
  return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Datos inválidos.' });
}

const iso = (ts) => ts?.toDate?.()?.toISOString() || null;

// Whitelist explícita: nunca hacemos spread ciego de lo que hay en Firestore.
function serializeContact(id, c) {
  return {
    id,
    name: c.name,
    phone: c.phone || '',
    email: c.email || '',
    product: c.product || '',
    source: c.source || 'other',
    tags: c.tags || [],
    status: c.status || 'active',
    ownerEmail: c.ownerEmail,
    ownerName: c.ownerName,
    nextActivityAt: iso(c.nextActivityAt),
    lastActivityAt: iso(c.lastActivityAt),
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
}

function serializeActivity(id, a) {
  return {
    id,
    type: a.type,
    body: a.body || '',
    done: !!a.done,
    outcome: a.outcome || null,
    authorEmail: a.authorEmail,
    authorName: a.authorName,
    dueAt: iso(a.dueAt),
    createdAt: iso(a.createdAt),
  };
}

// Carga un contacto y valida propiedad (vendedor solo los suyos).
async function loadOwned(req, res) {
  const ref = db.collection(CONTACTS).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: 'Contacto no encontrado.' });
    return null;
  }
  const c = snap.data();
  if (!isAdminLike(req.user) && c.ownerEmail !== req.user.email) {
    res.status(403).json({ error: 'No puedes ver contactos de otro vendedor.' });
    return null;
  }
  return { ref, c };
}

// Query base según rol: el vendedor queda atado a lo suyo; el admin ve todo
// (o filtra por owner). Solo igualdad → índice de campo único (automático).
function scopedQuery(req) {
  let q = db.collection(CONTACTS);
  if (!isAdminLike(req.user)) q = q.where('ownerEmail', '==', req.user.email);
  else if (req.query.owner) q = q.where('ownerEmail', '==', String(req.query.owner));
  return q;
}

// GET /api/contacts/agenda — recordatorios por atender (campana + badge del menú).
// Devuelve contactos activos con próxima tarea dentro de una ventana holgada; el
// cliente clasifica exacto (vencido/hoy) con su hora local.
router.get('/agenda', requireSeller, asyncHandler(async (req, res) => {
  const cutoff = Date.now() + 36 * 3600 * 1000; // +36h cubre "hoy" en cualquier zona
  const snap = await scopedQuery(req).limit(MAX).get();
  const items = snap.docs
    .map((d) => serializeContact(d.id, d.data()))
    .filter((c) => c.status === 'active' && c.nextActivityAt && new Date(c.nextActivityAt).getTime() <= cutoff)
    .sort((a, b) => String(a.nextActivityAt).localeCompare(String(b.nextActivityAt)))
    .slice(0, 50);
  res.json(items);
}));

// GET /api/contacts?owner= — todos los contactos del alcance (activos y cerrados).
// El board agrupa por urgencia y los filtros (origen/etiqueta) se aplican en el cliente.
router.get('/', requireSeller, asyncHandler(async (req, res) => {
  const snap = await scopedQuery(req).limit(MAX).get();
  const items = snap.docs
    .map((d) => serializeContact(d.id, d.data()))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  res.json(items);
}));

// POST /api/contacts — crea el contacto (queda a nombre del usuario).
router.post('/', requireSeller, asyncHandler(async (req, res) => {
  const parsed = crmContactSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed);
  const doc = {
    ...parsed.data,
    nextActivityAt: null,
    lastActivityAt: null,
    ownerUid: req.user.uid,
    ownerEmail: req.user.email,
    ownerName: req.user.name || req.user.email.split('@')[0],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection(CONTACTS).add(doc);
  const saved = (await ref.get()).data(); // re-lee para devolver timestamps reales
  res.status(201).json(serializeContact(ref.id, saved));
}));

// PUT /api/contacts/:id — edita datos del contacto (dueño o admin).
router.put('/:id', requireSeller, asyncHandler(async (req, res) => {
  const owned = await loadOwned(req, res);
  if (!owned) return;
  const parsed = crmContactSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed);
  const update = { ...parsed.data, updatedAt: FieldValue.serverTimestamp() };
  await owned.ref.update(update);
  res.json(serializeContact(req.params.id, { ...owned.c, ...update }));
}));

// PATCH /api/contacts/:id/board — mover en el board por urgencia: reprogramar el
// recordatorio (nextActivityAt) y/o cambiar el estado activo/cerrado.
router.patch('/:id/board', requireSeller, asyncHandler(async (req, res) => {
  const owned = await loadOwned(req, res);
  if (!owned) return;
  const { status, nextActivityAt } = req.body || {};
  const update = { updatedAt: FieldValue.serverTimestamp() };

  if (status !== undefined) {
    if (!CONTACT_STATUS.includes(status)) return res.status(400).json({ error: 'Estado inválido.' });
    update.status = status;
  }
  if (nextActivityAt !== undefined) {
    if (nextActivityAt === null) update.nextActivityAt = null;
    else {
      const d = new Date(nextActivityAt);
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'Fecha inválida.' });
      update.nextActivityAt = Timestamp.fromDate(d);
    }
  }
  await owned.ref.update(update);
  res.json({ ok: true });
}));

// GET /api/contacts/:id/activities — historial de la ficha (más reciente primero).
router.get('/:id/activities', requireSeller, asyncHandler(async (req, res) => {
  const owned = await loadOwned(req, res);
  if (!owned) return;
  const snap = await owned.ref.collection('activities').orderBy('createdAt', 'desc').limit(100).get();
  res.json(snap.docs.map((d) => serializeActivity(d.id, d.data())));
}));

// POST /api/contacts/:id/activities — registra interacción + refresca los denormalizados
// del contacto (next/lastActivityAt) dentro de UNA transacción, para que no se desincronicen.
router.post('/:id/activities', requireSeller, asyncHandler(async (req, res) => {
  const parsed = crmActivitySchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed);
  const contactRef = db.collection(CONTACTS).doc(req.params.id);

  const result = await db.runTransaction(async (tx) => {
    const cSnap = await tx.get(contactRef);
    if (!cSnap.exists) return { status: 404 };
    const c = cSnap.data();
    if (!isAdminLike(req.user) && c.ownerEmail !== req.user.email) return { status: 403 };

    const dueAt = parsed.data.dueAt ? Timestamp.fromDate(new Date(parsed.data.dueAt)) : null;
    const actRef = contactRef.collection('activities').doc();
    const activity = {
      type: parsed.data.type,
      body: parsed.data.body || '',
      outcome: parsed.data.outcome || null,
      dueAt,
      done: !dueAt, // sin fecha futura => es un registro histórico ya realizado
      authorEmail: req.user.email,
      authorName: req.user.name || req.user.email.split('@')[0],
      createdAt: FieldValue.serverTimestamp(),
    };
    tx.set(actRef, activity);

    const patch = {
      lastActivityAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    // Si esta actividad es una tarea futura y es la más próxima, actualiza el recordatorio.
    if (dueAt && (!c.nextActivityAt || dueAt.toMillis() < c.nextActivityAt.toMillis())) {
      patch.nextActivityAt = dueAt;
    }
    tx.update(contactRef, patch);
    return { id: actRef.id, activity };
  });

  if (result.status) {
    return res.status(result.status).json({ error: 'Contacto no encontrado o sin permiso.' });
  }
  res.status(201).json(serializeActivity(result.id, { ...result.activity, createdAt: null }));
}));

// DELETE /api/contacts/:id — borra el contacto y su subcolección de actividades.
router.delete('/:id', requireSeller, asyncHandler(async (req, res) => {
  const owned = await loadOwned(req, res);
  if (!owned) return;
  const acts = await owned.ref.collection('activities').limit(400).get();
  const batch = db.batch();
  acts.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(owned.ref);
  await batch.commit();
  res.json({ ok: true });
}));

module.exports = router;
