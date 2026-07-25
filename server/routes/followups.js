const router = require('express').Router();
const { requireSeller } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const crmService = require('../services/crm');

router.get('/', requireSeller, asyncHandler(async (req, res) => {
  const items = await crmService.getFollowups(req.user);
  res.json(items);
}));

router.post('/', requireSeller, asyncHandler(async (req, res) => {
  try {
    const followup = await crmService.createFollowup(req.body, req.user);
    res.status(201).json(followup);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

router.put('/:id', requireSeller, asyncHandler(async (req, res) => {
  try {
    const followup = await crmService.updateFollowup(req.params.id, req.body, req.user);
    res.json(followup);
  } catch (error) {
    const status = error.message.includes('encontrado') ? 404 : 
                   error.message.includes('No puedes') ? 403 : 400;
    res.status(status).json({ error: error.message });
  }
}));

router.patch('/:id/status', requireSeller, asyncHandler(async (req, res) => {
  try {
    await crmService.updateFollowupStatus(req.params.id, req.body?.status, req.user);
    res.json({ ok: true });
  } catch (error) {
    const status = error.message.includes('encontrado') ? 404 : 
                   error.message.includes('No puedes') ? 403 : 400;
    res.status(status).json({ error: error.message });
  }
}));

router.delete('/:id', requireSeller, asyncHandler(async (req, res) => {
  try {
    await crmService.deleteFollowup(req.params.id, req.user);
    res.json({ ok: true });
  } catch (error) {
    const status = error.message.includes('encontrado') ? 404 : 403;
    res.status(status).json({ error: error.message });
  }
}));

module.exports = router;
