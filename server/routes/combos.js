const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { imageUpload } = require('../utils/upload');
const comboService = require('../services/combos');

const upload = imageUpload({ maxSizeMb: 15 });

// GET /api/combos — vista PÚBLICA: solo combos activos y armables.
//   ?productId=X → solo los que contienen X (detalle del producto, Fase 2).
router.get('/', asyncHandler(async (req, res) => {
  const { productId } = req.query;
  let combos = (await comboService.listCombos()).filter((c) => c.active && !c.broken);
  if (productId) {
    combos = combos.filter((c) => c.productIds.includes(String(productId)));
  }
  res.json(combos);
}));

// GET /api/combos/all — vista de ADMIN: incluye inactivos y "rotos". Protegida.
router.get('/all', requireAdmin, asyncHandler(async (_req, res) => {
  res.json(await comboService.listCombos());
}));

// GET /api/combos/:id — detalle público de UN combo. 404 si no existe o no está
// disponible (inactivo o con algún producto borrado). Va después de '/all' para
// que esa ruta específica no caiga aquí.
router.get('/:id', asyncHandler(async (req, res) => {
  const combo = await comboService.getComboEnrichedById(req.params.id);
  if (!combo || !combo.active || combo.broken) {
    return res.status(404).json({ error: 'Combo no encontrado.' });
  }
  res.json(combo);
}));

// POST /api/combos/upload — sube la foto propia (opcional) de un combo. Igual
// que las fotos de producto: optimiza a WebP y la agrupa en catalog/combos/<id>/.
// Un combo nuevo (sin guardar aún) todavía no tiene id → cae a un bucket
// temporal por fecha, mismo patrón que productImages sin productId.
router.post('/upload', requireAdmin, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envió ninguna imagen.' });
  const url = await comboService.uploadImage(req.file, req.body?.comboId);
  res.status(201).json({ ok: true, url });
}));

// POST /api/combos — crea un combo.
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const combo = await comboService.createCombo(req.body);
    res.status(201).json(combo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// PUT /api/combos/:id — edita un combo.
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const combo = await comboService.updateCombo(req.params.id, req.body);
    res.json(combo);
  } catch (error) {
    if (error.message === 'Combo no encontrado.') return res.status(404).json({ error: error.message });
    res.status(400).json({ error: error.message });
  }
}));

// PATCH /api/combos/:id/active — enciende/apaga el combo sin borrarlo.
router.patch('/:id/active', requireAdmin, asyncHandler(async (req, res) => {
  try {
    await comboService.toggleActive(req.params.id, req.body.active);
    res.json({ ok: true });
  } catch (error) {
    if (error.message === 'Combo no encontrado.') return res.status(404).json({ error: error.message });
    throw error;
  }
}));

// DELETE /api/combos/:id — elimina un combo.
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  try {
    await comboService.deleteCombo(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    if (error.message === 'Combo no encontrado.') return res.status(404).json({ error: error.message });
    throw error;
  }
}));

module.exports = router;
// El checkout público (routes/orders.js) reusa esto para recalcular el precio
// del paquete desde Firestore en vez de confiar en el cliente.
module.exports.getComboEnrichedById = comboService.getComboEnrichedById;
