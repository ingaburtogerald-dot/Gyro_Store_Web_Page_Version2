const { db } = require('../firebase');
const config = require('../config');
const storage = require('./storage');

const APP_CONFIG = config.collections.appConfig;

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

async function getPublicConfig() {
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
      branding: biz.branding || {},
    };
    console.log('⚡ Caché de configuración pública reconstruido desde Firestore.');
  }
  return configCache;
}

async function getPricing() {
  const doc = await db.collection(APP_CONFIG).doc('pricing').get();
  if (!doc.exists) return defaultPricing;
  return doc.data();
}

async function setPricing(wholesaleDiscounts) {
  if (!Array.isArray(wholesaleDiscounts)) throw new Error('La lista de descuentos por mayor es inválida.');
  await db.collection(APP_CONFIG).doc('pricing').set({ wholesaleDiscounts });
  clearConfigCache();
}

async function setCategories(categories) {
  if (!Array.isArray(categories)) throw new Error('La lista de categorías es inválida.');
  
  const normalized = categories.map(cat => ({
    id: String(cat.id || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    name: String(cat.name || '').trim(),
    icon: String(cat.icon || '').trim()
  })).filter(cat => cat.id && cat.name);

  await db.collection(APP_CONFIG).doc('categories').set({ categories: normalized });
  clearConfigCache();
  return normalized;
}

async function getBusiness() {
  const doc = await db.collection(APP_CONFIG).doc('business').get();
  if (!doc.exists) return defaultBusiness;
  return doc.data();
}

async function setCostosFijos(costosFijos) {
  if (!costosFijos || typeof costosFijos !== 'object') throw new Error('Estructura de costos fijos inválida.');
  const normalized = {};
  for (const k of ['publicidad', 'utiles', 'servicios', 'garantias']) {
    normalized[k] = Number(costosFijos[k]) || 0;
  }
  await db.collection(APP_CONFIG).doc('business').set({ costosFijos: normalized }, { merge: true });
  clearConfigCache();
}

async function setBusiness(body) {
  const allowed = ['storeName', 'storeAddress', 'whatsapp', 'exchangeRate', 'socialLinks', 'deliveryPersonnel', 'branding', 'reviewLinks'];
  const update = {};
  for (const k of allowed) {
    if (body[k] !== undefined) update[k] = body[k];
  }
  if (update.exchangeRate !== undefined) {
    const rate = Number(update.exchangeRate);
    if (!rate || rate <= 0) throw new Error('Tipo de cambio inválido.');
    update.exchangeRate = rate;
  }
  if (Object.keys(update).length === 0) throw new Error('No hay campos válidos para actualizar.');
  await db.collection(APP_CONFIG).doc('business').set(update, { merge: true });
  clearConfigCache();
}

async function getFullConfig() {
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
  return fullConfigCache;
}

const BRANDING_FIELDS = {
  static: 'logoStaticUrl',
  animated: 'logoAnimatedUrl',
  favicon: 'faviconUrl',
  ticket: 'ticketLogoUrl',
  og: 'ogImageUrl',
  founder: 'founderUrl',
};

function resolveKind(raw) {
  return BRANDING_FIELDS[raw] ? raw : 'static';
}

async function uploadImage(file, rawKind) {
  const kind = resolveKind(rawKind);
  const field = BRANDING_FIELDS[kind];
  const ext = (file.originalname.match(/\.[^.]+$/) || ['.png'])[0];

  const bizRef = db.collection(APP_CONFIG).doc('business');
  const snap = await bizRef.get();
  const oldUrl = snap.exists ? snap.data()?.branding?.[field] : null;

  const url = await storage.uploadFile(
    file.buffer,
    'site/branding',
    `${kind}-${Date.now()}${ext}`,
    file.mimetype,
  );

  await bizRef.set({ branding: { [field]: url } }, { merge: true });
  clearConfigCache();

  if (oldUrl && oldUrl !== url) await storage.deleteFileByUrl(oldUrl);
  return { url, kind };
}

async function deleteImage(rawKind) {
  const kind = resolveKind(rawKind);
  const field = BRANDING_FIELDS[kind];

  const bizRef = db.collection(APP_CONFIG).doc('business');
  const snap = await bizRef.get();
  const oldUrl = snap.exists ? snap.data()?.branding?.[field] : null;

  await bizRef.set({ branding: { [field]: '' } }, { merge: true });
  clearConfigCache();

  if (oldUrl) await storage.deleteFileByUrl(oldUrl);
  return { kind };
}

const MAX_SLIDES = 12;

const defaultLanding = {
  headerCategories: [],
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

function normalizeSlide(raw, index) {
  const str = (v, max = 400) => String(v ?? '').slice(0, max);
  const mediaType = raw?.mediaType === 'video' ? 'video' : 'image';
  const actionType = raw?.actionType === 'link' ? 'link' : 'modal';
  return {
    id: str(raw?.id, 60) || `slide-${index + 1}-${Date.now()}`,
    eyebrow: str(raw?.eyebrow, 80),
    title: str(raw?.title, 120),
    description: str(raw?.description, 600),
    mediaUrl: str(raw?.mediaUrl, 600),
    mediaType,
    buttonText: str(raw?.buttonText, 60),
    actionType,
    actionTarget: str(raw?.actionTarget, 600),
    locked: index === 0 ? true : Boolean(raw?.locked),
  };
}

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

async function getLandingPage() {
  if (!landingCache) {
    landingCache = await readLanding();
    console.log('⚡ Caché de landing_page reconstruido desde Firestore.');
  }
  return landingCache;
}

async function setLandingPage(body) {
  const headerCategories = Array.isArray(body.headerCategories)
    ? [...new Set(body.headerCategories.map((id) => String(id)).filter(Boolean))].slice(0, 50)
    : [];

  if (!Array.isArray(body.heroSlides) || body.heroSlides.length === 0) {
    throw new Error('Debe haber al menos una diapositiva en el Hero.');
  }
  const heroSlides = body.heroSlides.slice(0, MAX_SLIDES).map(normalizeSlide);

  const ref = db.collection(APP_CONFIG).doc('landing_page');
  const prevSnap = await ref.get();
  const prevUrls = new Set(slideMediaUrls(prevSnap.exists ? prevSnap.data()?.heroSlides : []));
  const nextUrls = new Set(slideMediaUrls(heroSlides));

  await ref.set({ headerCategories, heroSlides }, { merge: false });
  clearConfigCache();

  for (const url of prevUrls) {
    if (!nextUrls.has(url)) await storage.deleteFileByUrl(url);
  }

  return { headerCategories, heroSlides };
}

async function uploadHeroSlide(file, rawSlideId) {
  const slideId = storage.safeId(rawSlideId, `slide-${Date.now()}`);
  const ext = (file.originalname.match(/\.[^.]+$/) || ['.png'])[0];

  const url = await storage.uploadFile(
    file.buffer,
    storage.folders.siteSlide(slideId),
    `media-${Date.now()}${ext}`,
    file.mimetype,
  );

  const mediaType = (file.mimetype || '').startsWith('video/') ? 'video' : 'image';
  return { url, mediaType };
}

module.exports = {
  getPublicConfig,
  getPricing,
  setPricing,
  setCategories,
  getBusiness,
  setCostosFijos,
  setBusiness,
  getFullConfig,
  uploadImage,
  deleteImage,
  getLandingPage,
  setLandingPage,
  uploadHeroSlide,
  clearConfigCache
};
