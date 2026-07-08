// Catálogo público basado en PLANTILLAS con enlace a inventario real.
// Un ítem del catálogo referencia una plantilla (`templateId`), un precio base,
// un mapa de disponibilidad por opción (toggles on/off) y un `variantMappings`
// que asigna un SKU de bodega a cada COMBINACIÓN exacta de variante.
// El detalle genera variantes "virtuales" desde la plantilla y consulta el stock
// real de cada SKU en la colección `products` (bodega).
const router = require('express').Router();
const multer = require('multer');
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const storage = require('../services/storage');

const CATALOG = config.collections.catalog;
const TEMPLATES = config.collections.templates;
const PRODUCTS = config.collections.products;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// Caché en memoria para el catálogo público
let catalogCache = null;
function clearCatalogCache() {
  catalogCache = null;
}

// ¿Está encendida una opción en el mapa de disponibilidad? (misma semántica que
// buildTemplateVariants: ausente = encendida; objeto = enabled !== false).
function optionEnabled(availability, key, opt) {
  const val = availability?.[key]?.[opt];
  if (val === undefined) return true;
  if (typeof val === 'object' && val !== null) return val.enabled !== false;
  return val !== false;
}

// Resumen compacto de variantes para las pills de la card en la lista pública:
// opciones ENCENDIDAS de los ejes de la plantilla, en orden, sin ejes de color
// (los colores ya se ven en las fotos). Ej: ["Tipo C", "Jack 3.5mm", "Con mic"].
function buildAxesSummary(item, template) {
  if (!template) return [];
  const out = [];
  for (const axis of template.axes || []) {
    if (axis.isColor) continue;
    for (const opt of axis.options || []) {
      if (optionEnabled(item.availability, axis.key, opt)) out.push(opt);
    }
  }
  return out.slice(0, 6);
}

// Cantidad de combinaciones ENCENDIDAS (producto cartesiano de opciones activas,
// incluyendo ejes de color). La card lo usa para decidir si el quick-add necesita
// selector de variante (>1) o puede agregar directo (<=1).
function countEnabledCombos(item, template) {
  if (!template) return 0;
  let total = 1;
  for (const axis of template.axes || []) {
    const enabled = (axis.options || []).filter((o) => optionEnabled(item.availability, axis.key, o)).length;
    total *= enabled;
  }
  return total;
}

// Calcula precio (precio base) e imágenes de un ítem para la lista/card.
function enrich(item, templatesById = {}) {
  // Para la card: usa las imágenes del ítem o, si no hay, las de cualquier color.
  const colorImages = Object.values(item.imagesByColor || {}).flat();
  const images = item.images && item.images.length ? item.images : colorImages;

  if (item.templateId) {
    const template = templatesById[item.templateId];
    return {
      ...item,
      images,
      stock: 1,
      price: item.basePrice || 0,
      axesSummary: buildAxesSummary(item, template),
      variantCount: countEnabledCombos(item, template),
    };
  }
  // Ítem sin plantilla (dato antiguo): se muestra solo en admin, sin stock.
  return { ...item, images, stock: 0, price: item.price || 0, axesSummary: [], variantCount: 0 };
}

// Normaliza una entrada de variantMappings a la lista de códigos. Soporta el
// formato nuevo { skus: [...] } y el viejo { sku: "X" }.
function mappingSkus(entry) {
  if (!entry) return [];
  if (Array.isArray(entry.skus)) return entry.skus.filter(Boolean);
  if (entry.sku) return [entry.sku];
  return [];
}

// Genera variantes "virtuales" (producto cartesiano de los ejes de la plantilla).
// Los SKU de cada combinación se resuelven desde `variantMappings` (puede haber
// VARIOS códigos por combinación: la misma variante en distintas tandas). Si no hay
// `variantMappings`, se usa un fallback legacy desde availability SKUs.
// Una combinación tiene stock preliminar=1 si TODAS sus opciones están encendidas
// en `availability`; si alguna está apagada, stock=0. El stock real se resuelve
// después consultando la colección `products` y SUMANDO el stock de todos sus SKU.
function buildTemplateVariants(template, item) {
  const axes = template.axes || [];
  const axisLabels = axes.map((a) => a.label);
  const availability = item.availability || {};
  const variantMappings = item.variantMappings || {};
  const basePrice = item.basePrice || 0;

  let combos = [[]];
  for (const axis of axes) {
    const next = [];
    for (const combo of combos) {
      for (const opt of axis.options) next.push([...combo, { key: axis.key, opt }]);
    }
    combos = next;
  }

  const variants = combos.map((combo, idx) => {
    const axisValues = combo.map((c) => c.opt);
    const variantName = axisValues.join(' / ');

    // Determinar si todas las opciones están encendidas
    const allOn = combo.every((c) => {
      const m = availability[c.key];
      if (!m || m[c.opt] === undefined) return true;
      const val = m[c.opt];
      if (typeof val === 'object' && val !== null) return val.enabled !== false;
      return val !== false;
    });

    // Resolver SKU(s): primero desde variantMappings (puede ser varios), fallback a legacy.
    let skus = mappingSkus(variantMappings[variantName]);
    if (skus.length === 0) {
      // Fallback legacy: tomar el primer SKU encontrado en los ejes del availability
      for (const c of combo) {
        const val = availability[c.key]?.[c.opt];
        if (typeof val === 'object' && val !== null && val.sku) {
          skus = [val.sku];
          break;
        }
      }
    }

    return {
      id: `tpl-${idx}`,
      name: item.name,
      variantName,
      axisValues,
      price: basePrice,
      sku: skus[0] || null, // representativo (compat)
      skus,
      stock: allOn ? 1 : 0,
      specs: [],
    };
  });

  return { variants, axisLabels };
}

// GET /api/catalog?category=&promo= — lista pública del catálogo (con caché en memoria).
router.get('/', asyncHandler(async (req, res) => {
  const { category, promo, all } = req.query;

  if (!catalogCache) {
    // Las plantillas se traen junto al catálogo para resolver axesSummary
    // (pills de variantes de las cards) sin costo extra por request: todo
    // queda en el mismo caché en memoria.
    const [snap, tplSnap] = await Promise.all([
      db.collection(CATALOG).get(),
      db.collection(TEMPLATES).get(),
    ]);
    const templatesById = {};
    tplSnap.docs.forEach((d) => { templatesById[d.id] = d.data(); });
    catalogCache = snap.docs.map((d) => enrich({ id: d.id, ...d.data() }, templatesById));
    console.log('⚡ Caché del catálogo reconstruido desde Firestore.');
  }

  // Ordenamos una copia para evitar mutar el array en caché
  let items = [...catalogCache].sort((a, b) => (a.order || 0) - (b.order || 0));

  // Filtrado en memoria
  if (promo === 'true') {
    items = items.filter((it) => it.isPromo === true);
  }
  if (category && category !== 'all') {
    items = items.filter((it) => it.category === category);
  }
  if (all !== 'true') {
    items = items.filter((it) => it.published !== false && it.templateId);
  }
  res.json(items);
}));

// ── Endpoints de administración (modo edición del catálogo) ──

// GET /api/catalog/warehouse-products — productos de bodega para el combobox del admin.
// Devuelve la lista completa de productos (code, name, stock) sin requerir rol seller.
router.get('/warehouse-products', requireAdmin, asyncHandler(async (req, res) => {
  const snap = await db.collection(PRODUCTS).get();
  const items = snap.docs
    .map((d) => {
      const p = d.data();
      return { id: d.id, code: p.code, name: p.name, stock: p.stock || 0 };
    })
    .filter((p) => !p.deletedAt)
    .sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true }));
  res.json(items);
}));

// POST /api/catalog/upload — sube imágenes del producto y devuelve sus URLs.
router.post('/upload', requireAdmin, upload.array('images', 10), asyncHandler(async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No se enviaron imágenes.' });
  const urls = [];
  for (const file of req.files) {
    const ext = (file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0];
    urls.push(await storage.uploadFile(file.buffer, 'catalog-images', `${Date.now()}-${Math.floor(Math.random() * 1000)}${ext}`, file.mimetype));
  }
  res.status(201).json({ urls });
}));

// PATCH /api/catalog/reorder — guarda el nuevo orden tras el drag & drop.
router.patch('/reorder', requireAdmin, asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Formato inválido.' });
  const batch = db.batch();
  items.forEach((it) => {
    if (it.id && typeof it.order === 'number') {
      batch.update(db.collection(CATALOG).doc(it.id), { order: it.order, updatedAt: FieldValue.serverTimestamp() });
    }
  });
  await batch.commit();
  clearCatalogCache();
  res.json({ ok: true });
}));

// Normaliza el cuerpo del ítem del catálogo (campos compartidos por POST y PUT).
function buildCatalogFields(body) {
  const { name, description, category, images, isPromo,
    imagesByColor, badges, tiktokUrl, compareAtPrice, specs, published,
    templateId, basePrice, availability, variantMappings } = body;
  return {
    name: String(name).trim(),
    description: String(description || '').trim(),
    category: String(category).trim(),
    images: Array.isArray(images) ? images : [],
    imagesByColor: imagesByColor && typeof imagesByColor === 'object' ? imagesByColor : {},
    badges: Array.isArray(badges) ? badges.map((s) => String(s).trim()).filter(Boolean) : [],
    tiktokUrl: String(tiktokUrl || '').trim(),
    compareAtPrice: Number(compareAtPrice) || 0,
    specs: Array.isArray(specs) ? specs.filter((s) => s && s.label) : [],
    published: published !== false,
    isPromo: Boolean(isPromo),
    // ── Plantilla ──
    templateId: String(templateId || '').trim(),
    basePrice: Number(basePrice) || 0,
    availability: availability && typeof availability === 'object' ? availability : {},
    // Mapeo de combinaciones a SKUs de bodega: { "opt1 / opt2 / opt3": { sku: "CODE" } }
    variantMappings: variantMappings && typeof variantMappings === 'object' ? variantMappings : {},
  };
}

// POST /api/catalog — crea un ítem del catálogo.
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { name, category } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'Nombre y categoría son obligatorios.' });

  const last = await db.collection(CATALOG).orderBy('order', 'desc').limit(1).get();
  const order = last.empty ? 0 : (last.docs[0].data().order || 0) + 1;

  const fields = buildCatalogFields(req.body);
  const item = {
    ...fields,
    price: fields.basePrice,
    order,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection(CATALOG).add(item);
  clearCatalogCache();
  res.status(201).json({ id: ref.id, ...item });
}));

// PUT /api/catalog/:id — edita un ítem del catálogo.
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(CATALOG).doc(req.params.id);
  if (!(await ref.get()).exists) return res.status(404).json({ error: 'Producto no encontrado.' });
  const fields = buildCatalogFields(req.body);
  const update = {
    ...fields,
    price: fields.basePrice,
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.update(update);
  clearCatalogCache();
  res.json({ id: req.params.id, ...update });
}));

// PATCH /api/catalog/:id/promo — alterna la marca de promoción.
router.patch('/:id/promo', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(CATALOG).doc(req.params.id);
  if (!(await ref.get()).exists) return res.status(404).json({ error: 'Producto no encontrado.' });
  await ref.update({ isPromo: Boolean(req.body.isPromo), updatedAt: FieldValue.serverTimestamp() });
  clearCatalogCache();
  res.json({ ok: true });
}));

// DELETE /api/catalog/:id — elimina un ítem del catálogo.
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(CATALOG).doc(req.params.id);
  if (!(await ref.get()).exists) return res.status(404).json({ error: 'Producto no encontrado.' });
  await ref.delete();
  clearCatalogCache();
  res.json({ ok: true });
}));

// GET /api/catalog/:id — detalle. Resuelve la plantilla y genera sus variantes.
router.get('/:id', asyncHandler(async (req, res) => {
  const doc = await db.collection(CATALOG).doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Producto no encontrado.' });

  const item = { id: doc.id, ...doc.data() };

  if (item.templateId) {
    const tplDoc = await db.collection(TEMPLATES).doc(item.templateId).get();
    const template = tplDoc.exists ? { id: tplDoc.id, ...tplDoc.data() } : { axes: [], specs: [] };
    let { variants, axisLabels } = buildTemplateVariants(template, item);

    // Consulta de stock real en bodega por SKU (juntando todos los códigos de todas las variantes)
    const skusToFetch = [...new Set(variants.flatMap(v => v.skus || []).filter(Boolean))];
    const stockBySku = {};

    if (skusToFetch.length > 0) {
      const batches = [];
      for (let i = 0; i < skusToFetch.length; i += 10) {
        const batch = skusToFetch.slice(i, i + 10);
        batches.push(db.collection(config.collections.products).where('code', 'in', batch).get());
      }
      const snaps = await Promise.all(batches);
      snaps.forEach(snap => {
        snap.docs.forEach(d => {
          const prodData = d.data();
          stockBySku[prodData.code] = prodData.stock || 0;
        });
      });
    }

    variants = variants.map(v => {
      if (v.stock === 0) return v; // si ya estaba apagada, sigue 0
      // Stock de la variante = SUMA del stock de todos sus códigos de bodega.
      v.stock = (v.skus || []).reduce((sum, code) => sum + (stockBySku[code] || 0), 0);
      return v;
    });

    const inStock = variants.some((v) => v.stock > 0);
    const colorImages = Object.values(item.imagesByColor || {}).flat();
    const images = item.images && item.images.length ? item.images : colorImages;
    return res.json({
      ...item,
      images,
      variants,
      axisLabels,
      imagesByColor: item.imagesByColor || {},
      badges: Array.isArray(item.badges) ? item.badges : [],
      tiktokUrl: item.tiktokUrl || '',
      compareAtPrice: item.compareAtPrice || 0,
      // specs del ítem; si no las personalizaron, hereda las de la plantilla.
      specs: Array.isArray(item.specs) && item.specs.length ? item.specs : (template.specs || []),
      published: item.published !== false,
      basePrice: item.basePrice || 0,
      price: item.basePrice || 0,
      stock: inStock ? 1 : 0,
    });
  }

  // Ítem antiguo sin plantilla: se devuelve sin variantes.
  res.json({
    ...item,
    variants: [],
    axisLabels: [],
    imagesByColor: item.imagesByColor || {},
    badges: Array.isArray(item.badges) ? item.badges : [],
    tiktokUrl: item.tiktokUrl || '',
    compareAtPrice: item.compareAtPrice || 0,
    specs: Array.isArray(item.specs) ? item.specs : [],
    published: item.published !== false,
    price: item.price || 0,
    stock: 0,
  });
}));

module.exports = router;
// Las rutas de plantillas invalidan este caché cuando cambian los ejes
// (el axesSummary de las cards se computa desde la plantilla).
module.exports.clearCatalogCache = clearCatalogCache;
