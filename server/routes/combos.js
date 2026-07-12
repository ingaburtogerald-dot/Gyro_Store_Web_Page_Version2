// Combos ("Comprados juntos frecuentemente"): publicaciones que emparejan DOS
// productos del catálogo a un precio de paquete. Un combo es simétrico: aparece
// en la página de detalle de CUALQUIERA de sus dos productos.
//
// El descuento NO toca inventario/factura: el checkout público solo arma un
// mensaje de WhatsApp + un pedido pendiente. El combo se aplica al total y al
// mensaje en la Fase 3; aquí (Fase 1) solo es CRUD de administración.
const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const COMBOS = config.collections.combos;
const CATALOG = config.collections.catalog;

// Imagen de portada de un ítem del catálogo: sus imágenes propias o, si no hay,
// las de cualquier color (misma lógica que enrich() del catálogo).
function coverImage(item) {
  if (Array.isArray(item.images) && item.images.length) return item.images[0];
  const colorImages = Object.values(item.imagesByColor || {}).flat();
  return colorImages[0] || '';
}

// Precio unitario de referencia del ítem (el mismo que muestra la card pública).
function itemPrice(item) {
  return Number(item.basePrice ?? item.price) || 0;
}

// Resuelve los productos referenciados y calcula el ahorro. `productsById` es el
// mapa de TODO el catálogo (pocos docs, se lee de una sola vez por request).
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
  // Un combo con algún producto borrado queda "roto": no se puede mostrar.
  const missing = (combo.productIds || []).length - products.length;

  return {
    id: combo.id,
    name: combo.name || products.map((p) => p.name).join(' + '),
    productIds: combo.productIds || [],
    price,
    active: combo.active !== false,
    products,
    normalTotal,
    savings: Math.max(0, normalTotal - price),
    broken: missing > 0,
  };
}

// Lee el catálogo completo una vez y lo indexa por id. El catálogo es pequeño;
// no vale la pena un `where(documentId, 'in', ...)` con sus límites de 10/30.
async function loadProductsById() {
  const snap = await db.collection(CATALOG).get();
  const map = {};
  snap.docs.forEach((d) => { map[d.id] = { id: d.id, ...d.data() }; });
  return map;
}

// Normaliza y valida el cuerpo de un combo. Devuelve { fields } o { error }.
async function buildComboFields(body, productsById) {
  const name = String(body.name || '').trim();
  const price = Number(body.price);
  const ids = Array.isArray(body.productIds)
    ? [...new Set(body.productIds.map((s) => String(s || '').trim()).filter(Boolean))]
    : [];

  if (ids.length !== 2) return { error: 'Un combo debe tener exactamente 2 productos distintos.' };
  if (!(price > 0)) return { error: 'El precio del paquete debe ser mayor a 0.' };
  for (const id of ids) {
    if (!productsById[id]) return { error: `El producto ${id} no existe en el catálogo.` };
  }

  return {
    fields: {
      name, // vacío ⇒ se autogenera en la lectura ("A + B")
      productIds: ids,
      price,
      active: body.active !== false,
    },
  };
}

// Lee todos los combos enriquecidos y ordenados por nombre.
async function listCombos() {
  const productsById = await loadProductsById();
  const snap = await db.collection(COMBOS).get();
  return snap.docs
    .map((d) => enrichCombo({ id: d.id, ...d.data() }, productsById))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}

// Un combo enriquecido por id (o null si no existe). Lo usa el detalle público y
// el checkout (para recalcular el precio del paquete desde Firestore).
async function getComboEnrichedById(id) {
  const doc = await db.collection(COMBOS).doc(id).get();
  if (!doc.exists) return null;
  const productsById = await loadProductsById();
  return enrichCombo({ id: doc.id, ...doc.data() }, productsById);
}

// GET /api/combos — vista PÚBLICA: solo combos activos y armables.
//   ?productId=X → solo los que contienen X (detalle del producto, Fase 2).
router.get('/', asyncHandler(async (req, res) => {
  const { productId } = req.query;
  let combos = (await listCombos()).filter((c) => c.active && !c.broken);
  if (productId) {
    combos = combos.filter((c) => c.productIds.includes(String(productId)));
  }
  res.json(combos);
}));

// GET /api/combos/all — vista de ADMIN: incluye inactivos y "rotos". Protegida.
router.get('/all', requireAdmin, asyncHandler(async (_req, res) => {
  res.json(await listCombos());
}));

// GET /api/combos/:id — detalle público de UN combo. 404 si no existe o no está
// disponible (inactivo o con algún producto borrado). Va después de '/all' para
// que esa ruta específica no caiga aquí.
router.get('/:id', asyncHandler(async (req, res) => {
  const combo = await getComboEnrichedById(req.params.id);
  if (!combo || !combo.active || combo.broken) {
    return res.status(404).json({ error: 'Combo no encontrado.' });
  }
  res.json(combo);
}));

// POST /api/combos — crea un combo.
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const productsById = await loadProductsById();
  const { fields, error } = await buildComboFields(req.body, productsById);
  if (error) return res.status(400).json({ error });

  const doc = {
    ...fields,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  const ref = await db.collection(COMBOS).add(doc);
  res.status(201).json(enrichCombo({ id: ref.id, ...doc }, productsById));
}));

// PUT /api/combos/:id — edita un combo.
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(COMBOS).doc(req.params.id);
  if (!(await ref.get()).exists) return res.status(404).json({ error: 'Combo no encontrado.' });

  const productsById = await loadProductsById();
  const { fields, error } = await buildComboFields(req.body, productsById);
  if (error) return res.status(400).json({ error });

  await ref.update({ ...fields, updatedAt: FieldValue.serverTimestamp() });
  res.json(enrichCombo({ id: req.params.id, ...fields }, productsById));
}));

// PATCH /api/combos/:id/active — enciende/apaga el combo sin borrarlo.
router.patch('/:id/active', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(COMBOS).doc(req.params.id);
  if (!(await ref.get()).exists) return res.status(404).json({ error: 'Combo no encontrado.' });
  await ref.update({ active: Boolean(req.body.active), updatedAt: FieldValue.serverTimestamp() });
  res.json({ ok: true });
}));

// DELETE /api/combos/:id — elimina un combo.
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(COMBOS).doc(req.params.id);
  if (!(await ref.get()).exists) return res.status(404).json({ error: 'Combo no encontrado.' });
  await ref.delete();
  res.json({ ok: true });
}));

module.exports = router;
// El checkout público (routes/orders.js) reusa esto para recalcular el precio
// del paquete desde Firestore en vez de confiar en el cliente.
module.exports.getComboEnrichedById = getComboEnrichedById;
