const { db, FieldValue } = require('../firebase');
const config = require('../config');
const storage = require('./storage');

const COMBOS = config.collections.combos;
const CATALOG = config.collections.catalog;

function coverImage(item) {
  if (Array.isArray(item.images) && item.images.length) return item.images[0];
  const colorImages = Object.values(item.imagesByColor || {}).flat();
  return colorImages[0] || '';
}

function itemPrice(item) {
  return Number(item.basePrice ?? item.price) || 0;
}

function enrichCombo(combo, productsById) {
  const products = (combo.productIds || [])
    .map((id) => {
      const item = productsById[id];
      if (!item) return null;
      return {
        id,
        name: item.name || '',
        description: String(item.description || ''),
        image: coverImage(item),
        price: itemPrice(item),
      };
    })
    .filter(Boolean);

  const normalTotal = products.reduce((sum, p) => sum + p.price, 0);
  const price = Number(combo.price) || 0;
  const missing = (combo.productIds || []).length - products.length;

  return {
    id: combo.id,
    name: combo.name || products.map((p) => p.name).join(' + '),
    image: combo.image || '',
    productIds: combo.productIds || [],
    price,
    active: combo.active !== false,
    products,
    normalTotal,
    savings: Math.max(0, normalTotal - price),
    broken: missing > 0,
  };
}

async function loadProductsById() {
  const snap = await db.collection(CATALOG).get();
  const map = {};
  snap.docs.forEach((d) => { map[d.id] = { id: d.id, ...d.data() }; });
  return map;
}

async function buildComboFields(body, productsById) {
  const name = String(body.name || '').trim();
  const price = Number(body.price);
  const ids = Array.isArray(body.productIds)
    ? [...new Set(body.productIds.map((s) => String(s || '').trim()).filter(Boolean))]
    : [];
  const image = typeof body.image === 'string' ? body.image.trim() : '';

  if (ids.length !== 2) return { error: 'Un combo debe tener exactamente 2 productos distintos.' };
  if (!(price > 0)) return { error: 'El precio del paquete debe ser mayor a 0.' };
  for (const id of ids) {
    if (!productsById[id]) return { error: `El producto ${id} no existe en el catálogo.` };
  }

  return {
    fields: {
      name,
      productIds: ids,
      price,
      active: body.active !== false,
      image,
    },
  };
}

async function listCombos() {
  const productsById = await loadProductsById();
  const snap = await db.collection(COMBOS).get();
  return snap.docs
    .map((d) => enrichCombo({ id: d.id, ...d.data() }, productsById))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}

async function getComboEnrichedById(id) {
  const doc = await db.collection(COMBOS).doc(id).get();
  if (!doc.exists) return null;
  const productsById = await loadProductsById();
  return enrichCombo({ id: doc.id, ...doc.data() }, productsById);
}

async function uploadImage(file, comboId) {
  const folder = storage.folders.comboImage(comboId);
  const opt = await storage.optimizeImageBuffer(file.buffer);
  const ext = opt.ext ?? (file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0];
  const contentType = opt.contentType ?? file.mimetype;
  const url = await storage.uploadFile(opt.buffer, folder, `combo-${Date.now()}${ext}`, contentType);
  return url;
}

async function createCombo(body) {
  const productsById = await loadProductsById();
  const { fields, error } = await buildComboFields(body, productsById);
  if (error) throw new Error(error);

  const doc = {
    ...fields,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection(COMBOS).add(doc);
  return enrichCombo({ id: ref.id, ...doc }, productsById);
}

async function updateCombo(id, body) {
  const ref = db.collection(COMBOS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Combo no encontrado.');

  const productsById = await loadProductsById();
  const { fields, error } = await buildComboFields(body, productsById);
  if (error) throw new Error(error);

  const oldImage = snap.data()?.image || '';
  await ref.update({ ...fields, updatedAt: FieldValue.serverTimestamp() });

  if (oldImage && oldImage !== fields.image) await storage.deleteFileByUrl(oldImage);

  return enrichCombo({ id, ...fields }, productsById);
}

async function toggleActive(id, active) {
  const ref = db.collection(COMBOS).doc(id);
  if (!(await ref.get()).exists) throw new Error('Combo no encontrado.');
  await ref.update({ active: Boolean(active), updatedAt: FieldValue.serverTimestamp() });
}

async function deleteCombo(id) {
  const ref = db.collection(COMBOS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Combo no encontrado.');
  const image = snap.data()?.image || '';
  await ref.delete();
  if (image) await storage.deleteFileByUrl(image);
}

module.exports = {
  listCombos,
  getComboEnrichedById,
  uploadImage,
  createCombo,
  updateCombo,
  toggleActive,
  deleteCombo,
};
