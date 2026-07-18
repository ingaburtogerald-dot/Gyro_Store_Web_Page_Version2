// GET /api/config — datos de negocio públicos que el catálogo y los portales
// necesitan al cargar (sin requerir login). Fuente única desde server/config.js.
const router = require('express').Router();
const config = require('../config');
const { db } = require('../firebase');
const { requireSeller, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const storage = require('../services/storage');
const { imageUpload } = require('../utils/upload');

const APP_CONFIG = config.collections.appConfig;
// Subida del logo del header (imagen estática o GIF animado). Máx 10 MB.
const logoUpload = imageUpload({ maxSizeMb: 10 });

// Caché en memoria para las configuraciones de la tienda
let configCache = null;
let fullConfigCache = null;

function clearConfigCache() {
  configCache = null;
  fullConfigCache = null;
}

const defaultPricing = {
  wholesaleDiscounts: [
    { minQty: 2, maxQty: 2, discountPercent: 3 },
    { minQty: 3, maxQty: 5, discountPercent: 5 },
    { minQty: 6, maxQty: 11, discountPercent: 10 },
    { minQty: 12, maxQty: null, discountPercent: 15 }
  ]
};

const defaultBusiness = {
  costosFijos: {
    publicidad: 10,
    utiles: 5,
    servicios: 5,
    garantias: 5
  }
};

router.get('/', asyncHandler(async (req, res) => {
  if (!configCache) {
    const pricingDoc = await db.collection(APP_CONFIG).doc('pricing').get();
    const pricing = pricingDoc.exists ? pricingDoc.data() : defaultPricing;

    // Consultamos bizDoc para que si el administrador actualizó WhatsApp/tipo de cambio en la BD, se refleje públicamente
    const bizDoc = await db.collection(APP_CONFIG).doc('business').get();
    const biz = bizDoc.exists ? bizDoc.data() : {};

    configCache = {
      storeName: biz.storeName || 'Gyro Store',
      storeAddress: biz.storeAddress || 'Managua, Nicaragua',
      whatsapp: biz.whatsapp || config.whatsapp,
      currency: config.currency,
      exchangeRate: biz.exchangeRate || config.exchangeRate,
      wholesaleDiscounts: pricing.wholesaleDiscounts || defaultPricing.wholesaleDiscounts,
      categories: config.categories,
      socialLinks: biz.socialLinks || {
        instagram: 'https://instagram.com/gyrostore',
        facebook: 'https://facebook.com/gyrostore',
        tiktok: 'https://tiktok.com/@gyrostore',
      },
      // Identidad de marca editable desde el admin (logo del header). Vacío = el
      // front usa los archivos por defecto del repo (/logo-estatico.jpg, /logo-animado.gif).
      branding: biz.branding || {},
    };
    console.log('⚡ Caché de configuración pública reconstruido desde Firestore.');
  }
  res.json(configCache);
}));

// GET /api/config/pricing - descuentos por mayor (público para vendedores)
router.get('/pricing', requireSeller, asyncHandler(async (req, res) => {
  const doc = await db.collection(APP_CONFIG).doc('pricing').get();
  if (!doc.exists) {
    return res.json(defaultPricing);
  }
  res.json(doc.data());
}));

// PUT /api/config/pricing - editar descuentos (solo admin)
router.put('/pricing', requireAdmin, asyncHandler(async (req, res) => {
  const { wholesaleDiscounts } = req.body;
  if (!Array.isArray(wholesaleDiscounts)) {
    return res.status(400).json({ error: 'La lista de descuentos por mayor es inválida.' });
  }
  await db.collection(APP_CONFIG).doc('pricing').set({ wholesaleDiscounts });
  clearConfigCache();
  res.json({ ok: true });
}));

// GET /api/config/business - costos fijos y otros configs (solo admin, ya que vendedores no deben ver costos fijos)
router.get('/business', requireAdmin, asyncHandler(async (req, res) => {
  const doc = await db.collection(APP_CONFIG).doc('business').get();
  if (!doc.exists) {
    return res.json(defaultBusiness);
  }
  res.json(doc.data());
}));

// PUT /api/config/costos-fijos - editar costos fijos (solo admin)
router.put('/costos-fijos', requireAdmin, asyncHandler(async (req, res) => {
  const costosFijos = req.body;
  if (!costosFijos || typeof costosFijos !== 'object') {
    return res.status(400).json({ error: 'Estructura de costos fijos inválida.' });
  }
  const normalized = {};
  for (const k of ['publicidad', 'utiles', 'servicios', 'garantias']) {
    normalized[k] = Number(costosFijos[k]) || 0;
  }
  await db.collection(APP_CONFIG).doc('business').set({ costosFijos: normalized }, { merge: true });
  clearConfigCache();
  res.json({ ok: true });
}));

// PUT /api/config/business — actualiza configuración general de la tienda (admin).
// Cubre: whatsapp, dirección, redes sociales, tipo de cambio, nombre.
router.put('/business', requireAdmin, asyncHandler(async (req, res) => {
  const allowed = ['storeName', 'storeAddress', 'whatsapp', 'exchangeRate', 'socialLinks', 'deliveryPersonnel', 'branding'];
  const update = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) update[k] = req.body[k];
  }
  if (update.exchangeRate !== undefined) {
    const rate = Number(update.exchangeRate);
    if (!rate || rate <= 0) return res.status(400).json({ error: 'Tipo de cambio inválido.' });
    update.exchangeRate = rate;
  }
  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: 'No hay campos válidos para actualizar.' });
  }
  await db.collection(APP_CONFIG).doc('business').set(update, { merge: true });
  clearConfigCache();
  res.json({ ok: true });
}));

// GET /api/config/full — configuración completa de la tienda (admin): business + pricing + costosFijos.
router.get('/full', requireAdmin, asyncHandler(async (req, res) => {
  if (!fullConfigCache) {
    const [bizDoc, pricingDoc] = await Promise.all([
      db.collection(APP_CONFIG).doc('business').get(),
      db.collection(APP_CONFIG).doc('pricing').get(),
    ]);

    const biz = bizDoc.exists ? bizDoc.data() : {};
    const pricing = pricingDoc.exists ? pricingDoc.data() : defaultPricing;

    fullConfigCache = {
      storeName: biz.storeName || 'Gyro Store',
      storeAddress: biz.storeAddress || 'Conchita Palacios 2c al lago 1c arriba',
      whatsapp: biz.whatsapp || config.whatsapp,
      exchangeRate: biz.exchangeRate || config.exchangeRate,
      socialLinks: biz.socialLinks || {
        instagram: 'https://instagram.com/gyrostore',
        facebook: 'https://facebook.com/gyrostore',
        tiktok: 'https://tiktok.com/@gyrostore',
      },
      costosFijos: biz.costosFijos || defaultBusiness.costosFijos,
      wholesaleDiscounts: pricing.wholesaleDiscounts || defaultPricing.wholesaleDiscounts,
      deliveryPersonnel: biz.deliveryPersonnel || [],
      branding: biz.branding || {},
    };
    console.log('⚡ Caché de configuración administrativa reconstruido.');
  }
  res.json(fullConfigCache);
}));

const LOGO_FIELDS = { static: 'logoStaticUrl', animated: 'logoAnimatedUrl' };

// POST /api/config/logo — sube el logo del header a R2 (site/logo/) y guarda su
// URL en la config del negocio. `kind`: 'static' (imagen) | 'animated' (GIF).
// El GIF se sube TAL CUAL (sin optimizar) para no perder la animación.
// Al REEMPLAZAR, borra el logo anterior de R2 para no dejar huérfanos/duplicados.
router.post('/logo', requireAdmin, logoUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo.' });
  const kind = req.body.kind === 'animated' ? 'animated' : 'static';
  const field = LOGO_FIELDS[kind];
  const ext = (req.file.originalname.match(/\.[^.]+$/) || ['.png'])[0];

  // URL anterior (para borrarla de R2 después de guardar la nueva).
  const bizRef = db.collection(APP_CONFIG).doc('business');
  const snap = await bizRef.get();
  const oldUrl = snap.exists ? snap.data()?.branding?.[field] : null;

  const url = await storage.uploadFile(
    req.file.buffer,
    'site/logo',
    `${kind}-${Date.now()}${ext}`,
    req.file.mimetype,
  );

  // Merge para no pisar el otro campo del branding (estático/animado).
  await bizRef.set({ branding: { [field]: url } }, { merge: true });
  clearConfigCache();

  // Borra el anterior de R2 (no-op si era un default del repo o estaba vacío).
  if (oldUrl && oldUrl !== url) await storage.deleteFileByUrl(oldUrl);

  res.json({ ok: true, url, kind });
}));

// DELETE /api/config/logo?kind=static|animated — quita el logo de la config y lo
// borra de R2. El header vuelve a usar el archivo por defecto del repo.
router.delete('/logo', requireAdmin, asyncHandler(async (req, res) => {
  const kind = req.query.kind === 'animated' ? 'animated' : 'static';
  const field = LOGO_FIELDS[kind];

  const bizRef = db.collection(APP_CONFIG).doc('business');
  const snap = await bizRef.get();
  const oldUrl = snap.exists ? snap.data()?.branding?.[field] : null;

  // Vacía el campo (string vacío → el front cae al logo por defecto).
  await bizRef.set({ branding: { [field]: '' } }, { merge: true });
  clearConfigCache();

  if (oldUrl) await storage.deleteFileByUrl(oldUrl);

  res.json({ ok: true, kind });
}));

module.exports = router;

