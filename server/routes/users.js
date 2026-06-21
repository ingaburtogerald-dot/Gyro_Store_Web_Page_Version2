// Gestión de usuarios: crear (local/invitado), editar roles, soft-delete a papelera
// (30 días), restaurar y purgar. El global_admin protegido no se puede tocar.
const router = require('express').Router();
const { db, auth, FieldValue } = require('../firebase');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { createUserSchema } = require('../utils/validators');
const { sendLocalInvite, sendGuestInvite } = require('../services/email');

const USERS = config.collections.users;
const TRASH = config.collections.usersDeleted;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const isProtected = (email) => email?.toLowerCase() === config.protectedEmail;

function genPassword(len = 14) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function deleteFromAuth(uid, email) {
  try {
    if (uid) return void (await auth.deleteUser(uid));
    if (email) {
      const rec = await auth.getUserByEmail(email.toLowerCase());
      await auth.deleteUser(rec.uid);
    }
  } catch (err) {
    if (err.code !== 'auth/user-not-found') console.error('deleteFromAuth:', err.message);
  }
}

async function purgeExpired() {
  const cutoff = new Date(Date.now() - RETENTION_MS);
  const snap = await db.collection(TRASH).where('deletedAt', '<', cutoff).get();
  for (const doc of snap.docs) {
    await deleteFromAuth(doc.data().uid, doc.data().email);
    await doc.ref.delete();
  }
}

// ── Papelera (antes de :id para que Express no la trague) ──
router.get('/trash', requireAdmin, asyncHandler(async (req, res) => {
  await purgeExpired();
  const snap = await db.collection(TRASH).orderBy('deletedAt', 'desc').get();
  const now = Date.now();
  res.json(snap.docs.map((d) => {
    const data = d.data();
    const expiresAt = data.expiresAt?.toDate?.() ?? new Date(data.expiresAt);
    return { id: d.id, ...data, daysLeft: Math.max(0, Math.ceil((expiresAt - now) / 86400000)) };
  }));
}));

router.post('/trash/:id/restore', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(TRASH).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'No está en la papelera.' });
  const { deletedAt, deletedBy, expiresAt, ...userData } = snap.data();
  if (userData.uid && userData.provider === 'local') {
    try { await auth.updateUser(userData.uid, { disabled: false }); } catch {}
  }
  const created = await db.collection(USERS).add({ ...userData, deletedAt: null, updatedAt: FieldValue.serverTimestamp() });
  await ref.delete();
  res.json({ id: created.id });
}));

router.delete('/trash/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(TRASH).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'No está en la papelera.' });
  await deleteFromAuth(snap.data().uid, snap.data().email);
  await ref.delete();
  res.json({ ok: true });
}));

// GET /api/users — usuarios activos (no eliminados).
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const snap = await db.collection(USERS).orderBy('createdAt', 'desc').get();
  
  // Obtener usuarios de Auth para inyectar sus fotos de perfil recientes
  let authUsers = [];
  try {
    const list = await auth.listUsers(1000);
    authUsers = list.users;
  } catch (err) {
    console.error('Error fetching auth users:', err.message);
  }
  const authMap = new Map(authUsers.map(u => [u.uid, u]));

  res.json(
    snap.docs
      .map((d) => {
        const data = d.data();
        const authRecord = data.uid ? authMap.get(data.uid) : null;
        return { 
          id: d.id, 
          ...data, 
          photoURL: authRecord?.photoURL || data.photoURL || '',
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null 
        };
      })
      .filter((u) => !u.deletedAt)
      .map((u) => ({ ...u, isProtected: isProtected(u.email) })),
  );
}));

// POST /api/users — crea usuario local (@gyrostore.com) o invitado (Google/Microsoft).
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Datos inválidos.' });
  const { email, displayName, roles, provider } = parsed.data;
  const targetEmail = email.toLowerCase();

  const dup = await db.collection(USERS).where('email', '==', targetEmail).limit(1).get();
  if (!dup.empty) return res.status(409).json({ error: 'Este correo ya está registrado.' });

  const base = {
    email: targetEmail,
    displayName,
    roles,
    provider,
    photoURL: '',
    isProtected: false,
    deletedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: req.user.email,
    mustChangePassword: provider === 'local',
  };

  if (provider === 'local') {
    const tempPassword = genPassword();
    let uid;
    try {
      const fb = await auth.createUser({ email: targetEmail, password: tempPassword, displayName, emailVerified: true });
      uid = fb.uid;
    } catch (err) {
      return res.status(409).json({ error: 'No se pudo crear la cuenta en Firebase Auth.' });
    }
    const ref = await db.collection(USERS).add({ ...base, uid });
    auth.generatePasswordResetLink(targetEmail)
      .then((resetLink) => sendLocalInvite({ to: targetEmail, displayName, email: targetEmail, roles, resetLink }))
      .catch((e) => console.error('Invite local:', e.message));
    return res.status(201).json({ id: ref.id, ...base, uid, tempPassword });
  }

  // Invitado externo (Google/Microsoft): se crea solo el doc; entra al loguearse.
  const ref = await db.collection(USERS).add({ ...base, uid: null });
  sendGuestInvite({ to: targetEmail, displayName, roles, appUrl: config.appUrl }).catch((e) => console.error('Invite guest:', e.message));
  res.status(201).json({ id: ref.id, ...base, uid: null });
}));

// PATCH /api/users/:id — editar nombre y/o roles.
router.patch('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(USERS).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Usuario no encontrado.' });
  if (isProtected(snap.data().email)) return res.status(403).json({ error: 'El administrador principal está protegido.' });

  const update = { updatedAt: FieldValue.serverTimestamp() };
  if (typeof req.body.displayName === 'string' && req.body.displayName.trim()) {
    update.displayName = req.body.displayName.trim();
    if (snap.data().uid) { try { await auth.updateUser(snap.data().uid, { displayName: update.displayName }); } catch {} }
  }
  if (Array.isArray(req.body.roles)) {
    const roles = [...new Set(req.body.roles.filter((r) => config.validRoles.includes(r)))];
    if (!roles.length) return res.status(400).json({ error: 'Selecciona al menos un rol válido.' });
    update.roles = roles;
  }
  await ref.update(update);
  res.json({ id: req.params.id, ...update });
}));

// DELETE /api/users/:id — soft delete → papelera (30 días).
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(USERS).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Usuario no encontrado.' });
  const data = snap.data();
  if (isProtected(data.email)) return res.status(403).json({ error: 'El administrador principal está protegido.' });
  if (data.email === req.user.email) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo.' });

  await db.collection(TRASH).add({ ...data, deletedAt: FieldValue.serverTimestamp(), deletedBy: req.user.email, expiresAt: new Date(Date.now() + RETENTION_MS) });
  if (data.uid && data.provider === 'local') { try { await auth.updateUser(data.uid, { disabled: true }); } catch {} }
  await ref.delete();
  res.json({ ok: true });
}));

// POST /api/users/:id/temp-password — genera una nueva contraseña temporal para un usuario local
router.post('/:id/temp-password', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(USERS).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Usuario no encontrado.' });
  
  const userData = snap.data();
  if (userData.provider !== 'local') {
    return res.status(400).json({ error: 'Solo se pueden generar contraseñas temporales para usuarios locales.' });
  }
  if (isProtected(userData.email)) {
    return res.status(403).json({ error: 'El administrador principal está protegido.' });
  }

  const tempPassword = genPassword();
  
  // 1. Actualiza en Firebase Auth
  await auth.updateUser(userData.uid, { password: tempPassword });

  // 2. Marca mustChangePassword en Firestore
  await ref.update({
    mustChangePassword: true,
    updatedAt: FieldValue.serverTimestamp()
  });

  res.json({ tempPassword, email: userData.email });
}));

module.exports = router;
