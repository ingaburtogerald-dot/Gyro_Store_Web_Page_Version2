const router = require('express').Router();
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAdmin } = require('../middleware/auth');
const ordersService = require('../services/orders');

router.post('/public', asyncHandler(async (req, res) => {
  try {
    const order = await ordersService.createPublicOrder(req.body);
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

router.get('/public', requireAdmin, asyncHandler(async (req, res) => {
  const result = await ordersService.getPublicOrders(req.query);
  res.json(result);
}));

router.patch('/public/:id/contacted', requireAdmin, asyncHandler(async (req, res) => {
  try {
    await ordersService.markContacted(req.params.id, Boolean(req.body.contacted), req.user?.email);
    res.json({ ok: true });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
}));

router.patch('/public/:id/follow-up', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const result = await ordersService.markFollowUp(req.params.id, req.user?.email);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
}));

router.delete('/public/:id', requireAdmin, asyncHandler(async (req, res) => {
  try {
    await ordersService.deletePublicOrder(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
}));

module.exports = router;
