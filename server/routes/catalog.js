// Catálogo público basado en PLANTILLAS con enlace a inventario real.
// Un ítem del catálogo referencia una plantilla (`templateId`), un precio base,
// un mapa de disponibilidad por opción (toggles on/off) y un `variantMappings`
// que asigna un SKU de bodega a cada COMBINACIÓN exacta de variante.
// El detalle genera variantes "virtuales" desde la plantilla y consulta el stock
// real de cada SKU en la colección `products` (bodega).
const router = require('express').Router();
const crypto = require('crypto');
const multer = require('multer');
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const storage = require('../services/storage');

const CATALOG = config.collections.catalog;
const TEMPLATES = config.collections.templates;
const PRODUCTS = config.collections.products;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Caché en memoria para el catálogo público
let catalogCache = null;
function clearCatalogCache() {
  catalogCache = null;
}

// Opciones que ESTE producto ofrece por eje (poda estructural). Si no hay lista
// guardada (o quedó vacía), se asumen TODAS — compat con datos previos.
function includedOptions(item, axis) {
  const sel = item.axisOptions && item.axisOptions[axis.key];
  if (Array.isArray(sel) && sel.length) return (axis.options || []).filter((o) => sel.includes(o));
  return axis.options || [];
}

// Resumen compacto de variantes para las pills de la card en la lista pública:
// opciones no-color OFRECIDAS por el producto (los colores ya se ven en las fotos).
function buildAxesSummary(item, template) {
  if (!template) return [];
  const out = [];
  for (const axis of template.axes || []) {
    if (axis.isColor) continue;
    for (const opt of includedOptions(item, axis)) out.push(opt);
  }
  return out.slice(0, 6);
}

// Cantidad de combinaciones = producto cartesiano de las opciones OFRECIDAS. La
// card lo usa para decidir si el quick-add necesita selector de variante (>1) o
// puede agregar directo (<=1).
function countCombos(item, template) {
  if (!template) return 0;
  let total = 1;
  for (const axis of template.axes || []) total *= includedOptions(item, axis).length || 1;
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
      variantCount: countCombos(item, template),
    };
  }
  // Ítem sin plantilla (dato antiguo): se muestra solo en admin, sin stock.
  return { ...item, images, stock: 0, price: item.price || 0, axesSummary: [], variantCount: 0 };
}

// ── Lectores 1-a-1 (toleran datos viejos { skus:[...] } durante la migración) ──
function mappingSku(entry) {
  if (!entry) return '';
  if (typeof entry.sku === 'string' && entry.sku) return entry.sku;
  if (Array.isArray(entry.skus) && entry.skus[0]) return entry.skus[0];
  return '';
}
function mappingSkus(entry) {
  if (!entry) return [];
  if (Array.isArray(entry.skus) && entry.skus.length > 0) return entry.skus;
  if (typeof entry.sku === 'string' && entry.sku) return [entry.sku];
  return [];
}
function mappingPrice(entry) {
  const p = Number(entry && entry.price);
  return p > 0 ? p : null;
}

// Genera variantes "virtuales" (producto cartesiano de TODAS las opciones de la
// plantilla — todas existen). Cada combinación resuelve UN SKU canónico y un
// precio (override de la variante, o el basePrice del padre). El stock se resuelve
// después sumando, por `sku`, todos los lotes de la colección `products`.
function buildTemplateVariants(template, item) {
  const axes = template.axes || [];
  const axisLabels = axes.map((a) => a.label);
  const variantMappings = item.variantMappings || {};
  const basePrice = item.basePrice || 0;

  let combos = [[]];
  for (const axis of axes) {
    const next = [];
    for (const combo of combos) {
      for (const opt of includedOptions(item, axis)) next.push([...combo, { key: axis.key, opt }]);
    }
    combos = next;
  }

  const variants = combos.map((combo, idx) => {
    const axisValues = combo.map((c) => c.opt);
    const variantName = axisValues.join(' / ');
    const entry = variantMappings[variantName];
    const sku = mappingSku(entry);
    const skus = mappingSkus(entry);

    return {
      id: `tpl-${idx}`,
      name: item.name,
      variantName,
      axisValues,
      price: mappingPrice(entry) ?? basePrice, // override por variante
      sku: sku || null,
      skus: skus.length > 0 ? skus : (sku ? [sku] : []),
      stock: 0, // se resuelve por `sku` en el detalle
      specs: [],
    };
  });

  const colorAxisIndex = axes.findIndex((a) => a.isColor);
  return { variants, axisLabels, colorAxisIndex: colorAxisIndex >= 0 ? colorAxisIndex : undefined };
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

router.get('/inventory-skus', requireAdmin, asyncHandler(async (req, res) => {
  const [snapNative, snapMigrated] = await Promise.all([
    db.collection(PRODUCTS).get(),
    db.collection(config.collections.migratedInventory).get()
  ]);
  
  const bySku = new Map();
  
  snapNative.docs.forEach((d) => {
    const p = d.data();
    if (p.deletedAt) return;
    const sku = p.sku || p.code; // fallback defensivo pre-migración
    if (!sku) return;
    const cur = bySku.get(sku) || { sku, name: p.name || '', stock: 0 };
    cur.stock += p.stock || 0;
    if (!cur.name && p.name) cur.name = p.name;
    if (p.price != null && (!cur.price || p.price > cur.price)) cur.price = p.price;
    bySku.set(sku, cur);
  });

  snapMigrated.docs.forEach((d) => {
    const p = d.data();
    if (p.deletedAt) return;
    const sku = p.code;
    if (!sku) return;
    const quantity = Math.max(0, parseInt(p.quantity, 10) || 0);
    const quantitySold = Math.max(0, parseInt(p.quantitySold, 10) || 0);
    const quantityReserved = Math.max(0, parseInt(p.quantityReserved, 10) || 0);
    const stock = Math.max(0, quantity - quantitySold - quantityReserved);
    
    // Solo mostramos migrados que tengan stock real disponible para evitar basura.
    if (stock > 0) {
      const cur = bySku.get(sku) || { sku, name: p.productName || '', stock: 0 };
      cur.stock += stock;
      if (!cur.name && p.productName) cur.name = p.productName;
      if (p.price != null && (!cur.price || p.price > cur.price)) cur.price = p.price;
      bySku.set(sku, cur);
    }
  });

  const items = [...bySku.values()].sort((a, b) =>
    String(a.sku).localeCompare(String(b.sku), undefined, { numeric: true }));
  res.json(items);
}));

// POST /api/catalog/upload — sube imágenes del producto y devuelve sus URLs.
router.post('/upload', requireAdmin, upload.array('images', 10), asyncHandler(async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No se enviaron imágenes.' });
  const urls = [];
  for (const file of req.files) {
    // Optimiza (resize + WebP) para que toda imagen subida pese/luzca igual que
    // el resto. Si sharp no está, cae al archivo original sin romper la subida.
    const opt = await storage.optimizeImageBuffer(file.buffer);
    const ext = opt.ext ?? (file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0];
    const contentType = opt.contentType ?? file.mimetype;
    // Nombre por CONTENIDO (hash del archivo original): la subida es idempotente.
    // Si el usuario reintenta tras un error de red (la foto ya llegó a R2), la key
    // es la misma → se sobrescribe en vez de duplicar, y la URL idéntica se
    // deduplica sola en la galería. Evita huérfanos y fotos repetidas.
    const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    urls.push(await storage.uploadFile(opt.buffer, 'catalog-images', `${hash}${ext}`, contentType));
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
    templateId, basePrice, variantMappings, axisOptions } = body;

  // axisOptions: qué opciones ofrece el producto por eje. { conector: ["Tipo C"], color: [...] }
  const cleanAxisOptions = (() => {
    if (!axisOptions || typeof axisOptions !== 'object') return {};
    const out = {};
    for (const [key, opts] of Object.entries(axisOptions)) {
      if (Array.isArray(opts)) out[key] = opts.map((s) => String(s)).filter(Boolean);
    }
    return out;
  })();

  // variantMappings nuevo: { "opt / opt": { skus, price? } }.
  const cleanMappings = (() => {
    if (!variantMappings || typeof variantMappings !== 'object') return {};
    const out = {};
    for (const [combo, entry] of Object.entries(variantMappings)) {
      if (!entry) continue;
      
      let skus = [];
      if (Array.isArray(entry.skus)) {
        skus = entry.skus.map(s => String(s || '').trim()).filter(Boolean);
      } else if (typeof entry.sku === 'string' && entry.sku.trim()) {
        skus = [entry.sku.trim()];
      }
      
      if (skus.length === 0) continue;
      
      const price = Number(entry.price);
      out[combo] = price > 0 ? { skus, sku: skus[0], price } : { skus, sku: skus[0] };
    }
    return out;
  })();

  return {
    name: String(name).trim(),
    description: String(description || '').trim(),
    category: String(category).trim(),
    images: Array.isArray(images) ? [...new Set(images)].filter(Boolean) : [],
    imagesByColor: (() => {
      if (!imagesByColor || typeof imagesByColor !== 'object') return {};
      const clean = {};
      for (const [color, urls] of Object.entries(imagesByColor)) {
        if (Array.isArray(urls)) clean[color] = [...new Set(urls)].filter(Boolean);
      }
      return clean;
    })(),
    badges: Array.isArray(badges) ? badges.map((s) => String(s).trim()).filter(Boolean) : [],
    tiktokUrl: String(tiktokUrl || '').trim(),
    compareAtPrice: Number(compareAtPrice) || 0,
    specs: Array.isArray(specs) ? specs.filter((s) => s && s.label) : [],
    published: published !== false,
    isPromo: Boolean(isPromo),
    // ── Plantilla ──
    templateId: String(templateId || '').trim(),
    basePrice: Number(basePrice) || 0,
    // Mapeo 1-a-1: { "opt1 / opt2 / opt3": { sku: "SKU", price?: 390 } }. `availability`
    // ya no se persiste (la disponibilidad se deriva del stock del SKU mapeado).
    variantMappings: cleanMappings,
    axisOptions: cleanAxisOptions,
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
  const oldDoc = await ref.get();
  if (!oldDoc.exists) return res.status(404).json({ error: 'Producto no encontrado.' });
  
  const fields = buildCatalogFields(req.body);
  const update = {
    ...fields,
    price: fields.basePrice,
    // Borra el residuo legacy de disponibilidad manual en docs ya guardados.
    availability: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await ref.update(update);
  clearCatalogCache();

  // Eliminar físicamente las imágenes removidas de Cloudflare R2
  const oldData = oldDoc.data();
  const oldImages = [...new Set([...(oldData.images || []), ...Object.values(oldData.imagesByColor || {}).flat()])];
  const newImages = [...new Set([...(update.images || []), ...Object.values(update.imagesByColor || {}).flat()])];
  const removed = oldImages.filter(url => typeof url === 'string' && !newImages.includes(url));
  
  if (removed.length > 0) {
    const { deleteFileByUrl } = require('../services/storage');
    removed.forEach(url => deleteFileByUrl(url).catch(console.error));
  }

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
    let { variants, axisLabels, colorAxisIndex } = buildTemplateVariants(template, item);

    // Stock real por SKU canónico: SUMA de todos los lotes que comparten ese `sku`.
    const skusToFetch = [...new Set(variants.flatMap((v) => v.skus || (v.sku ? [v.sku] : [])).filter(Boolean))];
    const stockBySku = {};

    if (skusToFetch.length > 0) {
      const batchesNative = [];
      const batchesMigrated = [];
      for (let i = 0; i < skusToFetch.length; i += 10) {
        const slice = skusToFetch.slice(i, i + 10);
        batchesNative.push(db.collection(PRODUCTS).where('sku', 'in', slice).get());
        batchesMigrated.push(db.collection(config.collections.migratedInventory).where('code', 'in', slice).get());
      }
      
      const snaps = await Promise.all([...batchesNative, ...batchesMigrated]);
      
      // Native snaps are the first half
      for (let i = 0; i < batchesNative.length; i++) {
        snaps[i].docs.forEach((d) => {
          const p = d.data();
          if (p.deletedAt) return;
          stockBySku[p.sku] = (stockBySku[p.sku] || 0) + (p.stock || 0); // suma lotes
        });
      }
      
      // Migrated snaps are the second half
      for (let i = batchesNative.length; i < snaps.length; i++) {
        snaps[i].docs.forEach((d) => {
          const p = d.data();
          if (p.deletedAt) return;
          const quantity = Math.max(0, parseInt(p.quantity, 10) || 0);
          const quantitySold = Math.max(0, parseInt(p.quantitySold, 10) || 0);
          const quantityReserved = Math.max(0, parseInt(p.quantityReserved, 10) || 0);
          const stock = Math.max(0, quantity - quantitySold - quantityReserved);
          stockBySku[p.code] = (stockBySku[p.code] || 0) + stock; // migrated uses p.code
        });
      }
    }

    variants = variants.map((v) => {
      const variantSkus = v.skus?.length ? v.skus : (v.sku ? [v.sku] : []);
      const stock = variantSkus.reduce((acc, s) => acc + (stockBySku[s] || 0), 0);
      return { ...v, stock };
    });

    const inStock = variants.some((v) => v.stock > 0);
    const colorImages = Object.values(item.imagesByColor || {}).flat();
    const images = item.images && item.images.length ? item.images : colorImages;
    return res.json({
      ...item,
      images,
      variants,
      axisLabels,
      colorAxisIndex,
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
