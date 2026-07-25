// Rutas de autenticación.
const router = require('express').Router();
const config = require('../config');
const authService = require('../services/auth');
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
  try {
    await authService.changePassword(req.user.uid, req.user.email, newPassword);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// POST /api/auth/photo — sube y actualiza la foto de perfil del usuario logueado.
// Las cuentas de Google/Microsoft toman su foto del proveedor; esto es para
// cuentas locales (email/contraseña). Guarda en Storage, actualiza Firebase Auth
// y el documento del usuario en Firestore.
router.post('/photo', authLimiter, requireAnyRole, upload.single('photo'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ninguna imagen.' });

  try {
    const photoURL = await authService.uploadPhoto(
      req.user.uid,
      req.user.email,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
    res.json({ ok: true, photoURL });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// POST /api/auth/whatsapp — actualiza el número de WhatsApp del usuario logueado.
router.post('/whatsapp', authLimiter, requireAnyRole, asyncHandler(async (req, res) => {
  const { whatsapp } = req.body;

  try {
    await authService.updateWhatsapp(req.user.email, whatsapp);
    res.json({ ok: true, whatsapp });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

module.exports = router;
