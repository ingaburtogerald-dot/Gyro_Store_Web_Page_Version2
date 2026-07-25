const router = require('express').Router();
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAdmin } = require('../middleware/auth');
const crmService = require('../services/crm');

// POST /api/feedback — público.
router.post('/', asyncHandler(async (req, res) => {
  try {
    const result = await crmService.submitFeedback(req.body);
    res.json({ ok: true, id: result.id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

// GET /api/feedback — solo admin. Últimos 100, más reciente primero.
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const items = await crmService.getFeedback();
  res.json(items);
}));

// PATCH /api/feedback/:id — solo admin. Cambia el status (ej. 'new' → 'resolved').
router.patch('/:id', requireAdmin, asyncHandler(async (req, res) => {
  try {
    await crmService.updateFeedbackStatus(req.params.id, String(req.body?.status ?? ''));
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

module.exports = router;
