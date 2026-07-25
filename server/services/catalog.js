const crypto = require('crypto');
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const storage = require('./storage');

const CATALOG = config.collections.catalog;
const TEMPLATES = config.collections.templates;
const PRODUCTS = config.collections.products;

let catalogCache = null;

function clearCatalogCache() {
  catalogCache = null;
}

function includedOptions(item, axis) {
  const sel = item.axisOptions && item.axisOptions[axis.key];
  if (Array.isArray(sel) && sel.length) return (axis.options || []).filter((o) => sel.includes(o));
  return axis.options || [];
}

function buildAxesSummary(item, template) {
  if (!template) return [];
  const out = [];
  for (const axis of template.axes || []) {
    if (axis.isColor) continue;
    for (const opt of includedOptions(item, axis)) out.push(opt);
  }
  return out.slice(0, 6);
}

function countCombos(item, template) {
  if (!template) return 0;
  let total = 1;
  for (const axis of template.axes || []) total *= includedOptions(item, axis).length || 1;
  return total;
}

function enrich(item, templatesById = {}) {
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
  return { ...item, images, stock: 0, price: item.price || 0, axesSummary: [], variantCount: 0 };
}

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
      price: mappingPrice(entry) ?? basePrice,
      sku: sku || null,
      skus: skus.length > 0 ? skus : (sku ? [sku] : []),
      stock: 0,
      specs: [],
    };
  });

  const colorAxisIndex = axes.findIndex((a) => a.isColor);
  return { variants, axisLabels, colorAxisIndex: colorAxisIndex >= 0 ? colorAxisIndex : undefined };
}

function buildCatalogFields(body) {
  const { name, description, category, images, isPromo,
    imagesByColor, badges, tiktokUrl, compareAtPrice, specs, published,
    templateId, basePrice, variantMappings, axisOptions } = body;

  const cleanAxisOptions = (() => {
    if (!axisOptions || typeof axisOptions !== 'object') return {};
    const out = {};
    for (const [key, opts] of Object.entries(axisOptions)) {
      if (Array.isArray(opts)) out[key] = opts.map((s) => String(s)).filter(Boolean);
    }
    return out;
  })();

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
    templateId: String(templateId || '').trim(),
    basePrice: Number(basePrice) || 0,
    variantMappings: cleanMappings,
    axisOptions: cleanAxisOptions,
  };
}

async function getCatalog(category, promo, all) {
  if (!catalogCache) {
    const [snap, tplSnap] = await Promise.all([
      db.collection(CATALOG).get(),
      db.collection(TEMPLATES).get(),
    ]);
    const templatesById = {};
    tplSnap.docs.forEach((d) => { templatesById[d.id] = d.data(); });
    catalogCache = snap.docs.map((d) => enrich({ id: d.id, ...d.data() }, templatesById));
    console.log('⚡ Caché del catálogo reconstruido desde Firestore.');
  }

  let items = [...catalogCache].sort((a, b) => (a.order || 0) - (b.order || 0));

  if (promo === 'true') {
    items = items.filter((it) => it.isPromo === true);
  }
  if (category && category !== 'all') {
    items = items.filter((it) => it.category === category);
  }
  if (all !== 'true') {
    items = items.filter((it) => it.published !== false && it.templateId);
  }
  return items;
}

async function getInventorySkus() {
  const [snapNative, snapMigrated] = await Promise.all([
    db.collection(PRODUCTS).get(),
    db.collection(config.collections.migratedInventory).get()
  ]);
  
  const bySku = new Map();
  
  snapNative.docs.forEach((d) => {
    const p = d.data();
    if (p.deletedAt) return;
    const sku = p.sku || p.code;
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
    
    if (stock > 0) {
      const cur = bySku.get(sku) || { sku, name: p.productName || '', stock: 0 };
      cur.stock += stock;
      if (!cur.name && p.productName) cur.name = p.productName;
      if (p.price != null && (!cur.price || p.price > cur.price)) cur.price = p.price;
      bySku.set(sku, cur);
    }
  });

  return [...bySku.values()].sort((a, b) =>
    String(a.sku).localeCompare(String(b.sku), undefined, { numeric: true }));
}

async function uploadImages(files, productId) {
  const folder = storage.folders.productImages(productId);
  const urls = [];
  for (const file of files) {
    const opt = await storage.optimizeImageBuffer(file.buffer);
    const ext = opt.ext ?? (file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0];
    const contentType = opt.contentType ?? file.mimetype;
    const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    urls.push(await storage.uploadFile(opt.buffer, folder, `${hash}${ext}`, contentType));
  }
  return urls;
}

async function reorderCatalog(items) {
  const batch = db.batch();
  items.forEach((it) => {
    if (it.id && typeof it.order === 'number') {
      batch.update(db.collection(CATALOG).doc(it.id), { order: it.order, updatedAt: FieldValue.serverTimestamp() });
    }
  });
  await batch.commit();
  clearCatalogCache();
}

async function createCatalogItem(body) {
  const last = await db.collection(CATALOG).orderBy('order', 'desc').limit(1).get();
  const order = last.empty ? 0 : (last.docs[0].data().order || 0) + 1;

  const fields = buildCatalogFields(body);
  const item = {
    ...fields,
    price: fields.basePrice,
    order,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection(CATALOG).add(item);
  clearCatalogCache();
  return { id: ref.id, ...item };
}

async function updateCatalogItem(id, body) {
  const ref = db.collection(CATALOG).doc(id);
  const oldDoc = await ref.get();
  if (!oldDoc.exists) throw new Error('Producto no encontrado.');
  
  const fields = buildCatalogFields(body);
  const update = {
    ...fields,
    price: fields.basePrice,
    availability: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await ref.update(update);
  clearCatalogCache();

  const oldData = oldDoc.data();
  const oldImages = [...new Set([...(oldData.images || []), ...Object.values(oldData.imagesByColor || {}).flat()])];
  const newImages = [...new Set([...(update.images || []), ...Object.values(update.imagesByColor || {}).flat()])];
  const removed = oldImages.filter(url => typeof url === 'string' && !newImages.includes(url));
  
  if (removed.length > 0) {
    removed.forEach(url => storage.deleteFileByUrl(url).catch(console.error));
  }

  return { id, ...update };
}

async function togglePromo(id, isPromo) {
  const ref = db.collection(CATALOG).doc(id);
  if (!(await ref.get()).exists) throw new Error('Producto no encontrado.');
  await ref.update({ isPromo: Boolean(isPromo), updatedAt: FieldValue.serverTimestamp() });
  clearCatalogCache();
}

async function deleteCatalogItem(id) {
  const ref = db.collection(CATALOG).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Producto no encontrado.');

  const data = snap.data();
  const images = [...new Set([
    ...(data.images || []),
    ...Object.values(data.imagesByColor || {}).flat(),
  ])].filter((url) => typeof url === 'string');

  await ref.delete();
  clearCatalogCache();

  images.forEach((url) => storage.deleteFileByUrl(url).catch((err) => console.error('R2 delete (catalog):', err.message)));
}

async function getCatalogItemDetail(id) {
  const doc = await db.collection(CATALOG).doc(id).get();
  if (!doc.exists) throw new Error('Producto no encontrado.');

  const item = { id: doc.id, ...doc.data() };

  if (item.templateId) {
    const tplDoc = await db.collection(TEMPLATES).doc(item.templateId).get();
    const template = tplDoc.exists ? { id: tplDoc.id, ...tplDoc.data() } : { axes: [], specs: [] };
    let { variants, axisLabels, colorAxisIndex } = buildTemplateVariants(template, item);

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
      
      for (let i = 0; i < batchesNative.length; i++) {
        snaps[i].docs.forEach((d) => {
          const p = d.data();
          if (p.deletedAt) return;
          stockBySku[p.sku] = (stockBySku[p.sku] || 0) + (p.stock || 0);
        });
      }
      
      for (let i = batchesNative.length; i < snaps.length; i++) {
        snaps[i].docs.forEach((d) => {
          const p = d.data();
          if (p.deletedAt) return;
          const quantity = Math.max(0, parseInt(p.quantity, 10) || 0);
          const quantitySold = Math.max(0, parseInt(p.quantitySold, 10) || 0);
          const quantityReserved = Math.max(0, parseInt(p.quantityReserved, 10) || 0);
          const stock = Math.max(0, quantity - quantitySold - quantityReserved);
          stockBySku[p.code] = (stockBySku[p.code] || 0) + stock;
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
    return {
      ...item,
      images,
      variants,
      axisLabels,
      colorAxisIndex,
      templateAxes: template.axes || [],
      imagesByColor: item.imagesByColor || {},
      badges: Array.isArray(item.badges) ? item.badges : [],
      tiktokUrl: item.tiktokUrl || '',
      compareAtPrice: item.compareAtPrice || 0,
      specs: Array.isArray(item.specs) && item.specs.length ? item.specs : (template.specs || []),
      published: item.published !== false,
      basePrice: item.basePrice || 0,
      price: item.basePrice || 0,
      stock: inStock ? 1 : 0,
    };
  }

  return {
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
  };
}

module.exports = {
  clearCatalogCache,
  getCatalog,
  getInventorySkus,
  uploadImages,
  reorderCatalog,
  createCatalogItem,
  updateCatalogItem,
  togglePromo,
  deleteCatalogItem,
  getCatalogItemDetail,
};
