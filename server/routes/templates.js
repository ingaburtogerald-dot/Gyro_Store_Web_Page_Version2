// Plantillas de producto: el "molde" reutilizable de características por categoría.
// Solo describe ejes de variantes (Conexión, Micrófono, Color…) y specs técnicas.
// NO contiene precio, disponibilidad ni imágenes (eso vive en el ítem del catálogo).
const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');

const TEMPLATES = config.collections.templates;

// Normaliza el cuerpo de una plantilla (compartido por POST y PUT).
function buildTemplateFields(body) {
  const { name, category, axes, specs } = body;
  return {
    name: String(name || '').trim(),
    category: String(category || '').trim(),
    axes: Array.isArray(axes)
      ? axes
          .map((a) => ({
            key: String(a.key || '').trim(),
            label: String(a.label || '').trim(),
            options: Array.isArray(a.options) ? a.options.map((o) => String(o).trim()).filter(Boolean) : [],
            isColor: Boolean(a.isColor),
          }))
          .filter((a) => a.key && a.label && a.options.length)
      : [],
    specs: Array.isArray(specs) ? specs.filter((s) => s && s.label) : [],
  };
}

// GET /api/templates?category= — lista de plantillas (opcionalmente por categoría).
router.get('/', asyncHandler(async (req, res) => {
  const { category } = req.query;
  let query = db.collection(TEMPLATES);
  if (category) query = query.where('category', '==', category);
  const snap = await query.get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
}));

// GET /api/templates/:id — detalle de una plantilla.
router.get('/:id', asyncHandler(async (req, res) => {
  const doc = await db.collection(TEMPLATES).doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Plantilla no encontrada.' });
  res.json({ id: doc.id, ...doc.data() });
}));

// POST /api/templates — crea una plantilla (admin).
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const fields = buildTemplateFields(req.body);
  if (!fields.name || !fields.category) return res.status(400).json({ error: 'Nombre y categoría son obligatorios.' });
  const ref = await db.collection(TEMPLATES).add({
    ...fields,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  res.status(201).json({ id: ref.id, ...fields });
}));

// PUT /api/templates/:id — edita una plantilla (admin).
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(TEMPLATES).doc(req.params.id);
  if (!(await ref.get()).exists) return res.status(404).json({ error: 'Plantilla no encontrada.' });
  const fields = buildTemplateFields(req.body);
  await ref.update({ ...fields, updatedAt: FieldValue.serverTimestamp() });
  res.json({ id: req.params.id, ...fields });
}));

// DELETE /api/templates/:id — elimina una plantilla (admin).
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const ref = db.collection(TEMPLATES).doc(req.params.id);
  if (!(await ref.get()).exists) return res.status(404).json({ error: 'Plantilla no encontrada.' });
  await ref.delete();
  res.json({ ok: true });
}));

module.exports = router;
