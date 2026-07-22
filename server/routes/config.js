// GET /api/config — datos de negocio públicos que el catálogo y los portales
// necesitan al cargar (sin requerir login). Fuente única desde server/config.js.
const router = require('express').Router();
const config = require('../config');
const { db } = require('../firebase');
const { requireSeller, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const storage = require('../services/storage');
const { imageUpload, mediaUpload } = require('../utils/upload');

const APP_CONFIG = config.collections.appConfig;
// Subida del logo del header (imagen estática o GIF animado/video). Máx 25 MB para videos del logo.
const logoUpload = mediaUpload({ maxSizeMb: 25 });
// Subida de la media de un slide del Hero (imagen, GIF o video). Videos pesan → 50 MB.
const slideUpload = mediaUpload({ maxSizeMb: 50 });

// Caché en memoria para las configuraciones de la tienda
let configCache = null;
let fullConfigCache = null;
let landingCache = null;

function clearConfigCache() {
  configCache = null;
  fullConfigCache = null;
  landingCache = null;
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

const defaultCategories = [
  { id: 'audifonos-kz', name: 'Audífonos In Ear', icon: '🎧' },
  { id: 'accesorios-kz', name: 'Accesorios para audífonos KZ', icon: '🎚️' },
  { id: 'adaptador-bt', name: 'Adaptador Bluetooth para audífonos KZ', icon: '📶' },
  { id: 'accesorios-pc', name: 'Accesorios Para computadores', icon: '🖱️' },
  { id: 'accesorios-moto', name: 'Accesorios Para moto', icon: '🏍️' },
  { id: 'accesorios-gaming', name: 'Accesorios para gaming variados', icon: '🎮' },
];

router.get('/', asyncHandler(async (req, res) => {
  if (!configCache) {
    const [pricingDoc, bizDoc, catDoc] = await Promise.all([
      db.collection(APP_CONFIG).doc('pricing').get(),
      db.collection(APP_CONFIG).doc('business').get(),
      db.collection(APP_CONFIG).doc('categories').get(),
    ]);

    const pricing = pricingDoc.exists ? pricingDoc.data() : defaultPricing;
    const biz = bizDoc.exists ? bizDoc.data() : {};
    const categories = catDoc.exists ? catDoc.data().categories : defaultCategories;

    configCache = {
      storeName: biz.storeName || 'Gyro Store',
      storeAddress: biz.storeAddress || 'Managua, Nicaragua',
      whatsapp: biz.whatsapp || config.whatsapp,
      currency: config.currency,
      exchangeRate: biz.exchangeRate || config.exchangeRate,
      wholesaleDiscounts: pricing.wholesaleDiscounts || defaultPricing.wholesaleDiscounts,
      categories,
      socialLinks: biz.socialLinks || {
        instagram: 'https://instagram.com/gyrostore',
        facebook: 'https://facebook.com/gyrostore',
        tiktok: 'https://tiktok.com/@gyrostore',
      },
      reviewLinks: biz.reviewLinks || {
        google: 'https://g.page/r/CcAd-gQQQD6GEBM/review',
        facebook: 'https://www.facebook.com/people/Gyro-Store/61589182888082/reviews',
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

// PUT /api/config/categories - editar categorías (solo admin)
router.put('/categories', requireAdmin, asyncHandler(async (req, res) => {
  const { categories } = req.body;
  if (!Array.isArray(categories)) {
    return res.status(400).json({ error: 'La lista de categorías es inválida.' });
  }
  
  const normalized = categories.map(cat => ({
    id: String(cat.id || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    name: String(cat.name || '').trim(),
    icon: String(cat.icon || '').trim()
  })).filter(cat => cat.id && cat.name);

  await db.collection(APP_CONFIG).doc('categories').set({ categories: normalized });
  clearConfigCache();
  res.json({ ok: true, categories: normalized });
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
// Cubre: whatsapp, dirección, redes sociales, tipo de cambio, nombre, enlaces de reseña.
router.put('/business', requireAdmin, asyncHandler(async (req, res) => {
  const allowed = ['storeName', 'storeAddress', 'whatsapp', 'exchangeRate', 'socialLinks', 'deliveryPersonnel', 'branding', 'reviewLinks'];
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
      reviewLinks: biz.reviewLinks || {
        google: 'https://g.page/r/CcAd-gQQQD6GEBM/review',
        facebook: 'https://www.facebook.com/people/Gyro-Store/61589182888082/reviews',
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

// ── Landing page (modo edición inline): Hero + orden del header ──────────────
// Doc `app_config/landing_page`. Separado de `business` para no sobrecargar el doc
// que se lee globalmente. `headerCategories` = ids de categoría en el orden/visibilidad
// elegidos por el admin (los nombres siguen saliendo del catálogo). `heroSlides` =
// diapositivas del carrusel (máx 12); la #1 es la marca y va bloqueada (locked).
const MAX_SLIDES = 12;

// Slides por defecto: reflejan el Hero estático original mientras el admin no guarde.
// El slide 2 apuntaba a un producto hardcodeado; ahora es editable → target seguro.
const defaultLanding = {
  headerCategories: [], // vacío = el header usa todas las categorías en su orden natural
  heroSlides: [
    {
      id: 'slide-brand',
      eyebrow: 'CALIDAD DE SOBRA',
      title: 'Gyro Store',
      description: 'Audífonos, adaptadores y accesorios tecnológicos que suenan por encima de su precio. Equipamiento premium en Managua.',
      mediaUrl: '/videos/gyro-promo.mp4',
      mediaType: 'video',
      buttonText: 'Quiénes Somos',
      actionType: 'modal',
      actionTarget: '',
      locked: true,
    },
    {
      id: 'slide-kz-edx-pro',
      eyebrow: 'MONITOREO PROFESIONAL',
      title: 'KZ EDX Pro',
      description: 'Sonido de alta resolución, graves potentes y diseño ergonómico. El favorito de músicos y entusiastas del audio en Nicaragua.',
      mediaUrl: '/slide-demo.png',
      mediaType: 'image',
      buttonText: 'Comprar KZ EDX Pro',
      actionType: 'link',
      actionTarget: '/#catalogo',
      locked: false,
    },
  ],
};

// Normaliza/sanea un slide venido del cliente a la forma canónica del doc.
function normalizeSlide(raw, index) {
  const str = (v, max = 400) => String(v ?? '').slice(0, max);
  const mediaType = raw?.mediaType === 'video' ? 'video' : 'image';
  const actionType = raw?.actionType === 'link' ? 'link' : 'modal';
  return {
    // Id estable para agrupar su media en R2; si no viene, uno determinista.
    id: str(raw?.id, 60) || `slide-${index + 1}-${Date.now()}`,
    eyebrow: str(raw?.eyebrow, 80),
    title: str(raw?.title, 120),
    description: str(raw?.description, 600),
    mediaUrl: str(raw?.mediaUrl, 600),
    mediaType,
    buttonText: str(raw?.buttonText, 60),
    actionType,
    actionTarget: str(raw?.actionTarget, 600),
    // El primer slide siempre queda bloqueado (marca), pase lo que pase.
    locked: index === 0 ? true : Boolean(raw?.locked),
  };
}

// Todas las URLs de media que son archivos nuestros en R2 (para borrado de huérfanos).
function slideMediaUrls(slides) {
  return (slides || []).map((s) => s.mediaUrl).filter((u) => typeof u === 'string' && u);
}

async function readLanding() {
  const doc = await db.collection(APP_CONFIG).doc('landing_page').get();
  if (!doc.exists) return { ...defaultLanding };
  const data = doc.data() || {};
  return {
    headerCategories: Array.isArray(data.headerCategories) ? data.headerCategories : [],
    heroSlides: Array.isArray(data.heroSlides) && data.heroSlides.length
      ? data.heroSlides.map(normalizeSlide)
      : defaultLanding.heroSlides,
  };
}

// GET /api/config/landing_page — Hero + orden del header (público; lo consume el
// loader SSR de la home). Cacheado en memoria como el resto de la config.
router.get('/landing_page', asyncHandler(async (req, res) => {
  if (!landingCache) {
    landingCache = await readLanding();
    console.log('⚡ Caché de landing_page reconstruido desde Firestore.');
  }
  res.json(landingCache);
}));

// PUT /api/config/landing_page — guarda Hero + orden del header (admin). Al quitar
// un slide o reemplazar su media, borra de R2 los archivos que dejaron de usarse
// (mismo patrón que el logo). Nunca toca archivos que no sean del bucket.
router.put('/landing_page', requireAdmin, asyncHandler(async (req, res) => {
  const body = req.body || {};

  const headerCategories = Array.isArray(body.headerCategories)
    ? [...new Set(body.headerCategories.map((id) => String(id)).filter(Boolean))].slice(0, 50)
    : [];

  if (!Array.isArray(body.heroSlides) || body.heroSlides.length === 0) {
    return res.status(400).json({ error: 'Debe haber al menos una diapositiva en el Hero.' });
  }
  const heroSlides = body.heroSlides.slice(0, MAX_SLIDES).map(normalizeSlide);

  // Media que se dejó de usar respecto al doc anterior → borrar de R2.
  const ref = db.collection(APP_CONFIG).doc('landing_page');
  const prevSnap = await ref.get();
  const prevUrls = new Set(slideMediaUrls(prevSnap.exists ? prevSnap.data()?.heroSlides : []));
  const nextUrls = new Set(slideMediaUrls(heroSlides));

  await ref.set({ headerCategories, heroSlides }, { merge: false });
  clearConfigCache();

  // deleteFileByUrl es no-op seguro para URLs que no son del bucket (ej. /videos/…).
  for (const url of prevUrls) {
    if (!nextUrls.has(url)) await storage.deleteFileByUrl(url);
  }

  res.json({ ok: true, headerCategories, heroSlides });
}));

// POST /api/config/hero-slide — sube la media de un slide a R2 (site/slides/<id>/).
// Devuelve la URL pública + el tipo (image|video); el guardado del arreglo completo
// va aparte por PUT. El archivo se sube TAL CUAL (sin optimizar) para no perder la
// animación del GIF ni recodificar el video, igual que el logo. Acepta imagen/GIF/video.
router.post('/hero-slide', requireAdmin, slideUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo.' });
  const slideId = storage.safeId(req.body.slideId, `slide-${Date.now()}`);
  const ext = (req.file.originalname.match(/\.[^.]+$/) || ['.png'])[0];

  const url = await storage.uploadFile(
    req.file.buffer,
    storage.folders.siteSlide(slideId),
    `media-${Date.now()}${ext}`,
    req.file.mimetype,
  );

  // El tipo decide si el Hero lo pinta en <video> o <img>.
  const mediaType = (req.file.mimetype || '').startsWith('video/') ? 'video' : 'image';
  res.json({ ok: true, url, mediaType });
}));

module.exports = router;

