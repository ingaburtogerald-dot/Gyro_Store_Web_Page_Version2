const { db, FieldValue, Timestamp } = require('../firebase');
const config = require('../config');
const { crmContactSchema, crmActivitySchema, CONTACT_STATUS, feedbackSchema, followupSchema } = require('../utils/validators');
const { sendFeedbackEmail } = require('./email');
const logger = require('../utils/logger');

const CONTACTS = config.collections.contacts;
const FEEDBACK = config.collections.feedback;
const FOLLOWUPS = config.collections.followups;

const MAX = 500;
const LIST_LIMIT = 100;
const VALID_FEEDBACK_STATUS = ['new', 'resolved'];

const isAdminLike = (u) => u.roles.includes('admin') || u.roles.includes('global_admin');
const iso = (ts) => ts?.toDate?.()?.toISOString() || null;

// ==========================================
// 1. CONTACTS
// ==========================================
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

async function loadOwnedContact(id, user) {
  const ref = db.collection(CONTACTS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Contacto no encontrado.');
  const c = snap.data();
  if (!isAdminLike(user) && c.ownerEmail !== user.email) {
    throw new Error('No puedes ver contactos de otro vendedor.');
  }
  return { ref, c };
}

function scopedContactQuery(user, ownerQuery) {
  let q = db.collection(CONTACTS);
  if (!isAdminLike(user)) q = q.where('ownerEmail', '==', user.email);
  else if (ownerQuery) q = q.where('ownerEmail', '==', String(ownerQuery));
  return q;
}

async function getAgenda(user) {
  const cutoff = Date.now() + 36 * 3600 * 1000;
  const snap = await scopedContactQuery(user).limit(MAX).get();
  const items = snap.docs
    .map((d) => serializeContact(d.id, d.data()))
    .filter((c) => c.status === 'active' && c.nextActivityAt && new Date(c.nextActivityAt).getTime() <= cutoff)
    .sort((a, b) => String(a.nextActivityAt).localeCompare(String(b.nextActivityAt)))
    .slice(0, 50);
  return items;
}

async function getContacts(user, ownerQuery) {
  const snap = await scopedContactQuery(user, ownerQuery).limit(MAX).get();
  const items = snap.docs
    .map((d) => serializeContact(d.id, d.data()))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return items;
}

async function createContact(body, user) {
  const parsed = crmContactSchema.safeParse(body);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message || 'Datos inválidos.');
  const doc = {
    ...parsed.data,
    nextActivityAt: null,
    lastActivityAt: null,
    ownerUid: user.uid,
    ownerEmail: user.email,
    ownerName: user.name || user.email.split('@')[0],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection(CONTACTS).add(doc);
  const saved = (await ref.get()).data();
  return serializeContact(ref.id, saved);
}

async function updateContact(id, body, user) {
  const { ref, c } = await loadOwnedContact(id, user);
  const parsed = crmContactSchema.safeParse(body);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message || 'Datos inválidos.');
  const update = { ...parsed.data, updatedAt: FieldValue.serverTimestamp() };
  await ref.update(update);
  return serializeContact(id, { ...c, ...update });
}

async function updateContactBoard(id, updates, user) {
  const { ref } = await loadOwnedContact(id, user);
  const { status, nextActivityAt } = updates;
  const update = { updatedAt: FieldValue.serverTimestamp() };

  if (status !== undefined) {
    if (!CONTACT_STATUS.includes(status)) throw new Error('Estado inválido.');
    update.status = status;
  }
  if (nextActivityAt !== undefined) {
    if (nextActivityAt === null) update.nextActivityAt = null;
    else {
      const d = new Date(nextActivityAt);
      if (isNaN(d.getTime())) throw new Error('Fecha inválida.');
      update.nextActivityAt = Timestamp.fromDate(d);
    }
  }
  await ref.update(update);
}

async function getContactActivities(id, user) {
  const { ref } = await loadOwnedContact(id, user);
  const snap = await ref.collection('activities').orderBy('createdAt', 'desc').limit(100).get();
  return snap.docs.map((d) => serializeActivity(d.id, d.data()));
}

async function addContactActivity(id, body, user) {
  const parsed = crmActivitySchema.safeParse(body);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message || 'Datos inválidos.');
  const contactRef = db.collection(CONTACTS).doc(id);

  const result = await db.runTransaction(async (tx) => {
    const cSnap = await tx.get(contactRef);
    if (!cSnap.exists) return { status: 404 };
    const c = cSnap.data();
    if (!isAdminLike(user) && c.ownerEmail !== user.email) return { status: 403 };

    const dueAt = parsed.data.dueAt ? Timestamp.fromDate(new Date(parsed.data.dueAt)) : null;
    const actRef = contactRef.collection('activities').doc();
    const activity = {
      type: parsed.data.type,
      body: parsed.data.body || '',
      outcome: parsed.data.outcome || null,
      dueAt,
      done: !dueAt,
      authorEmail: user.email,
      authorName: user.name || user.email.split('@')[0],
      createdAt: FieldValue.serverTimestamp(),
    };
    tx.set(actRef, activity);

    const patch = {
      lastActivityAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (dueAt && (!c.nextActivityAt || dueAt.toMillis() < c.nextActivityAt.toMillis())) {
      patch.nextActivityAt = dueAt;
    }
    tx.update(contactRef, patch);
    return { id: actRef.id, activity };
  });

  if (result.status === 404) throw new Error('Contacto no encontrado.');
  if (result.status === 403) throw new Error('No puedes ver contactos de otro vendedor.');

  return serializeActivity(result.id, { ...result.activity, createdAt: null });
}

async function deleteContact(id, user) {
  const { ref } = await loadOwnedContact(id, user);
  const acts = await ref.collection('activities').limit(400).get();
  const batch = db.batch();
  acts.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(ref);
  await batch.commit();
}

// ==========================================
// 2. FEEDBACK
// ==========================================
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

async function submitFeedback(body) {
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message || 'Datos inválidos.');
  }
  const { type, message, userPhone } = parsed.data;

  const ref = await db.collection(FEEDBACK).add({
    type,
    message,
    userPhone: userPhone || null,
    status: 'new',
    createdAt: FieldValue.serverTimestamp(),
  });

  sendFeedbackEmail({ type, message, userPhone }).catch((err) => {
    logger.error('feedback_email_failed', { message: err.message });
  });

  return { id: ref.id };
}

async function getFeedback() {
  const snap = await db.collection(FEEDBACK).orderBy('createdAt', 'desc').limit(LIST_LIMIT).get();
  return snap.docs.map((d) => serializeFeedback(d.id, d.data()));
}

async function updateFeedbackStatus(id, status) {
  if (!VALID_FEEDBACK_STATUS.includes(status)) {
    throw new Error(`status debe ser: ${VALID_FEEDBACK_STATUS.join(' | ')}.`);
  }
  await db.collection(FEEDBACK).doc(id).update({ status });
}

// ==========================================
// 3. FOLLOWUPS
// ==========================================
function serializeFollowup(id, f) {
  return {
    id,
    ...f,
    createdAt: iso(f.createdAt),
    updatedAt: iso(f.updatedAt),
  };
}

async function loadOwnedFollowup(id, user) {
  const ref = db.collection(FOLLOWUPS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Seguimiento no encontrado.');
  const f = snap.data();
  if (!isAdminLike(user) && f.ownerEmail !== user.email) {
    throw new Error('No puedes modificar seguimientos de otro usuario.');
  }
  return { ref, f };
}

async function getFollowups(user) {
  const snap = isAdminLike(user)
    ? await db.collection(FOLLOWUPS).get()
    : await db.collection(FOLLOWUPS).where('ownerEmail', '==', user.email).get();
  const list = snap.docs.map((d) => serializeFollowup(d.id, d.data()));
  list.sort((a, b) => String(a.followUpDate || '').localeCompare(String(b.followUpDate || '')));
  return list;
}

async function createFollowup(body, user) {
  const parsed = followupSchema.safeParse(body);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message || 'Datos inválidos.');
  const doc = {
    ...parsed.data,
    ownerUid: user.uid,
    ownerEmail: user.email,
    ownerName: user.name || user.email.split('@')[0],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection(FOLLOWUPS).add(doc);
  return serializeFollowup(ref.id, doc);
}

async function updateFollowup(id, body, user) {
  const { ref, f } = await loadOwnedFollowup(id, user);
  const parsed = followupSchema.safeParse(body);
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message || 'Datos inválidos.');
  const update = { ...parsed.data, updatedAt: FieldValue.serverTimestamp() };
  await ref.update(update);
  return serializeFollowup(id, { ...f, ...update });
}

async function updateFollowupStatus(id, status, user) {
  const { ref } = await loadOwnedFollowup(id, user);
  if (!['pending', 'done', 'lost'].includes(status)) {
    throw new Error('Estado inválido.');
  }
  await ref.update({ status, updatedAt: FieldValue.serverTimestamp() });
}

async function deleteFollowup(id, user) {
  const { ref } = await loadOwnedFollowup(id, user);
  await ref.delete();
}

module.exports = {
  getAgenda,
  getContacts,
  createContact,
  updateContact,
  updateContactBoard,
  getContactActivities,
  addContactActivity,
  deleteContact,
  submitFeedback,
  getFeedback,
  updateFeedbackStatus,
  getFollowups,
  createFollowup,
  updateFollowup,
  updateFollowupStatus,
  deleteFollowup,
};
