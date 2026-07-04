// CRM v2: contactos/leads con historial de actividades.
//   - `contacts/{id}`            → la persona/lead (etapa del embudo + denormalizados).
//   - `contacts/{id}/activities` → subcolección con cada interacción (el historial).
// Admin/global_admin ven todos; el vendedor solo los suyos (validado en el server).
// Convive con /api/followups (legacy) durante la migración.
const router = require('express').Router();
const { db, FieldValue, Timestamp } = require('../firebase');
const config = require('../config');
const { requireSeller } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { crmContactSchema, crmActivitySchema, CRM_STAGES } = require('../utils/validators');

const CONTACTS = config.collections.contacts;
const PAGE_SIZE = 25;
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
    source: c.source || '',
    tags: c.tags || [],
    value: c.value || 0,
    stage: c.stage || 'new',
    stageOrder: c.stageOrder ?? 0,
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

// GET /api/contacts/metrics?owner= — conteos por etapa + tasa de conversión.
// Usa agregaciones .count() de Firestore: NO descarga documentos.
// (Definida antes de las rutas con parámetros para que "metrics" no sea capturado.)
router.get('/metrics', requireSeller, asyncHandler(async (req, res) => {
  const scoped = () => {
    let q = db.collection(CONTACTS);
    if (!isAdminLike(req.user)) q = q.where('ownerEmail', '==', req.user.email);
    else if (req.query.owner) q = q.where('ownerEmail', '==', String(req.query.owner));
    return q;
  };
  const counts = await Promise.all(
    CRM_STAGES.map((s) => scoped().where('stage', '==', s).count().get().then((r) => r.data().count)),
  );
  const byStage = Object.fromEntries(CRM_STAGES.map((s, i) => [s, counts[i]]));
  const closed = byStage.won + byStage.lost;
  res.json({
    byStage,
    total: counts.reduce((a, b) => a + b, 0),
    conversionRate: closed ? Number(((byStage.won / closed) * 100).toFixed(1)) : 0,
  });
}));

// GET /api/contacts/agenda — tareas por atender (para la campana y el badge del menú).
// Devuelve contactos con próxima actividad pendiente dentro de una ventana holgada;
// el cliente clasifica exacto (vencido/hoy) con su hora local. Excluye ganados/perdidos.
router.get('/agenda', requireSeller, asyncHandler(async (req, res) => {
  // +36h cubre "hoy" en cualquier zona horaria; el front filtra a vencido/hoy.
  const cutoff = Timestamp.fromMillis(Date.now() + 36 * 3600 * 1000);
  let q = db.collection(CONTACTS);
  if (!isAdminLike(req.user)) q = q.where('ownerEmail', '==', req.user.email);
  q = q.where('nextActivityAt', '<=', cutoff).orderBy('nextActivityAt', 'asc').limit(50);

  const snap = await q.get();
  const items = snap.docs
    .map((d) => serializeContact(d.id, d.data()))
    .filter((c) => c.stage !== 'won' && c.stage !== 'lost');
  res.json(items);
}));

// GET /api/contacts?stage=&owner=&cursor= — filtros + orden + paginación por cursor.
// El vendedor queda atado a lo suyo; el admin puede filtrar por owner.
router.get('/', requireSeller, asyncHandler(async (req, res) => {
  let q = db.collection(CONTACTS);

  if (!isAdminLike(req.user)) {
    q = q.where('ownerEmail', '==', req.user.email);
  } else if (req.query.owner) {
    q = q.where('ownerEmail', '==', String(req.query.owner));
  }

  if (req.query.stage && CRM_STAGES.includes(req.query.stage)) {
    q = q.where('stage', '==', String(req.query.stage));
  }

  // Orden estable para Kanban (por etapa y posición manual) y determinista para el cursor.
  q = q.orderBy('stage').orderBy('stageOrder').orderBy('createdAt', 'desc').limit(PAGE_SIZE);

  if (req.query.cursor) {
    const curSnap = await db.collection(CONTACTS).doc(String(req.query.cursor)).get();
    if (curSnap.exists) q = q.startAfter(curSnap);
  }

  const snap = await q.get();
  const items = snap.docs.map((d) => serializeContact(d.id, d.data()));
  const nextCursor = snap.docs.length === PAGE_SIZE ? snap.docs[snap.docs.length - 1].id : null;
  res.json({ items, nextCursor });
}));

// POST /api/contacts — crea el lead (queda a nombre del usuario).
router.post('/', requireSeller, asyncHandler(async (req, res) => {
  const parsed = crmContactSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed);
  const doc = {
    ...parsed.data,
    stageOrder: Date.now(), // al final de su columna; se reordena con fractional indexing
    nextActivityAt: null,
    lastActivityAt: null,
    ownerUid: req.user.uid,
    ownerEmail: req.user.email,
    ownerName: req.user.name || req.user.email.split('@')[0],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection(CONTACTS).add(doc);
  const saved = (await ref.get()).data(); // re-lee para devolver timestamps reales, no sentinels
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

// PATCH /api/contacts/:id/stage — mover en el Kanban (etapa + posición).
router.patch('/:id/stage', requireSeller, asyncHandler(async (req, res) => {
  const owned = await loadOwned(req, res);
  if (!owned) return;
  const { stage, stageOrder } = req.body || {};
  if (!CRM_STAGES.includes(stage)) return res.status(400).json({ error: 'Etapa inválida.' });
  await owned.ref.update({
    stage,
    stageOrder: typeof stageOrder === 'number' ? stageOrder : owned.c.stageOrder ?? 0,
    updatedAt: FieldValue.serverTimestamp(),
  });
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
    // Si esta actividad es una tarea futura y es la más próxima, actualiza el denormalizado.
    if (dueAt && (!c.nextActivityAt || dueAt.toMillis() < c.nextActivityAt.toMillis())) {
      patch.nextActivityAt = dueAt;
    }
    tx.update(contactRef, patch);
    return { id: actRef.id, activity };
  });

  if (result.status) {
    return res.status(result.status).json({ error: 'Contacto no encontrado o sin permiso.' });
  }
  // createdAt aún es sentinel dentro de la tx; el cliente lo refresca al invalidar caché.
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
