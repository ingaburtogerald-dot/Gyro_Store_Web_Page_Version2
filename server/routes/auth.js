// Rutas de autenticación.
const router = require('express').Router();
const { auth, db } = require('../firebase');
const config = require('../config');
const storage = require('../services/storage');
const { authLimiter } = require('../middleware/rateLimiter');
const { requireAnyRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { imageUpload } = require('../utils/upload');

// Imágenes en memoria, máx 5 MB.
const upload = imageUpload({ maxSizeMb: 5 });

// GET /api/auth/config — config pública de Firebase Web (para el login del navegador).
// No expone secretos: la apiKey web de Firebase es pública por diseño.
router.get('/config', (req, res) => {
  res.json({ ...config.firebaseWeb, configured: Boolean(config.firebaseWeb.apiKey) });
});

// GET /api/auth/me — confirma el token y devuelve los roles resueltos.
// requireAnyRole ya pobló req.user vía authenticate(). No usa authLimiter: se
// llama en cada carga de la app (recargas, varias pestañas) y ya exige token
// válido; queda cubierto por el apiLimiter global (120/min).
router.get('/me', requireAnyRole, (req, res) => {
  const { uid, email, name, photoURL, role, roles, mustChangePassword, whatsapp } = req.user;
  res.json({ uid, email, name, photoURL, role, roles, mustChangePassword, whatsapp });
});

// POST /api/auth/change-password — permite a un usuario logueado cambiar su contraseña
router.post('/change-password', authLimiter, requireAnyRole, asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
  }

  // 1. Actualiza en Firebase Authentication
  await auth.updateUser(req.user.uid, { password: newPassword });

  // 2. Quita la bandera de cambio obligatorio en Firestore
  const snap = await db.collection(config.collections.users)
    .where('email', '==', req.user.email.toLowerCase())
    .limit(1)
    .get();

  if (!snap.empty) {
    await snap.docs[0].ref.update({ mustChangePassword: false });
  }

  res.json({ ok: true });
}));

// POST /api/auth/photo — sube y actualiza la foto de perfil del usuario logueado.
// Las cuentas de Google/Microsoft toman su foto del proveedor; esto es para
// cuentas locales (email/contraseña). Guarda en Storage, actualiza Firebase Auth
// y el documento del usuario en Firestore.
router.post('/photo', authLimiter, requireAnyRole, upload.single('photo'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen.' });
  if (!req.file.mimetype || !req.file.mimetype.startsWith('image/')) {
    return res.status(400).json({ error: 'El archivo debe ser una imagen.' });
  }

  const ext = (req.file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0];
  const photoURL = await storage.uploadFile(
    req.file.buffer,
    storage.folders.profilePhoto(req.user.uid),
    `${Date.now()}${ext}`,
    req.file.mimetype,
  );

  // 1. Actualiza la foto en Firebase Authentication (se refleja en el token `picture`).
  await auth.updateUser(req.user.uid, { photoURL });

  // 2. Refleja la foto en el documento del usuario en Firestore (para listados).
  const snap = await db.collection(config.collections.users)
    .where('email', '==', req.user.email.toLowerCase())
    .limit(1)
    .get();
  if (!snap.empty) {
    await snap.docs[0].ref.update({ photoURL });
  }

  res.json({ ok: true, photoURL });
}));

// POST /api/auth/whatsapp — actualiza el número de WhatsApp del usuario logueado.
router.post('/whatsapp', authLimiter, requireAnyRole, asyncHandler(async (req, res) => {
  const { whatsapp } = req.body;
  if (typeof whatsapp !== 'string') {
    return res.status(400).json({ error: 'Número de WhatsApp inválido.' });
  }

  const snap = await db.collection(config.collections.users)
    .where('email', '==', req.user.email.toLowerCase())
    .limit(1)
    .get();

  if (!snap.empty) {
    await snap.docs[0].ref.update({ whatsapp });
  }

  res.json({ ok: true, whatsapp });
}));

module.exports = router;
