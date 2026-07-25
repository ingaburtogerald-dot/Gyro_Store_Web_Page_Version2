const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { imageUpload } = require('../utils/upload');
const catalogService = require('../services/catalog');

const upload = imageUpload({ maxSizeMb: 15 });

// GET /api/catalog?category=&promo= — lista pública del catálogo (con caché en memoria).
router.get('/', asyncHandler(async (req, res) => {
  const { category, promo, all } = req.query;
  const items = await catalogService.getCatalog(category, promo, all);
  res.json(items);
}));

// ── Endpoints de administración (modo edición del catálogo) ──

router.get('/inventory-skus', requireAdmin, asyncHandler(async (req, res) => {
  const items = await catalogService.getInventorySkus();
  res.json(items);
}));

// POST /api/catalog/upload — sube imágenes del producto y devuelve sus URLs.
router.post('/upload', requireAdmin, upload.array('images', 10), asyncHandler(async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No se enviaron imágenes.' });
  
  const urls = await catalogService.uploadImages(req.files, req.body?.productId);
  res.status(201).json({ urls });
}));

// PATCH /api/catalog/reorder — guarda el nuevo orden tras el drag & drop.
router.patch('/reorder', requireAdmin, asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Formato inválido.' });
  
  await catalogService.reorderCatalog(items);
  res.json({ ok: true });
}));

// POST /api/catalog — crea un ítem del catálogo.
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { name, category } = req.body;
  if (!name || !category) return res.status(400).json({ error: 'Nombre y categoría son obligatorios.' });

  const item = await catalogService.createCatalogItem(req.body);
  res.status(201).json(item);
}));

// PUT /api/catalog/:id — edita un ítem del catálogo.
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const update = await catalogService.updateCatalogItem(req.params.id, req.body);
    res.json(update);
  } catch (error) {
    if (error.message === 'Producto no encontrado.') return res.status(404).json({ error: error.message });
    throw error;
  }
}));

// PATCH /api/catalog/:id/promo — alterna la marca de promoción.
router.patch('/:id/promo', requireAdmin, asyncHandler(async (req, res) => {
  try {
    await catalogService.togglePromo(req.params.id, req.body.isPromo);
    res.json({ ok: true });
  } catch (error) {
    if (error.message === 'Producto no encontrado.') return res.status(404).json({ error: error.message });
    throw error;
  }
}));

// DELETE /api/catalog/:id — elimina un ítem del catálogo y sus imágenes de R2.
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  try {
    await catalogService.deleteCatalogItem(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    if (error.message === 'Producto no encontrado.') return res.status(404).json({ error: error.message });
    throw error;
  }
}));

// GET /api/catalog/:id — detalle. Resuelve la plantilla y genera sus variantes.
router.get('/:id', asyncHandler(async (req, res) => {
  try {
    const detail = await catalogService.getCatalogItemDetail(req.params.id);
    res.json(detail);
  } catch (error) {
    if (error.message === 'Producto no encontrado.') return res.status(404).json({ error: error.message });
    throw error;
  }
}));

module.exports = router;
// Las rutas de plantillas invalidan este caché cuando cambian los ejes
// (el axesSummary de las cards se computa desde la plantilla).
module.exports.clearCatalogCache = catalogService.clearCatalogCache;
