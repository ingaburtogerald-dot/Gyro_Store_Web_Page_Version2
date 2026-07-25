const router = require('express').Router();
const { asyncHandler } = require('../utils/asyncHandler');
const { requireAdmin } = require('../middleware/auth');
const { telemetryLimiter } = require('../middleware/rateLimiter');
const telemetryService = require('../services/telemetry');

router.post('/', telemetryLimiter, asyncHandler(async (req, res) => {
  const result = await telemetryService.trackEvent(req.body, req.headers, req.ip);
  res.json(result);
}));

router.post('/:id/click', telemetryLimiter, asyncHandler(async (req, res) => {
  try {
    await telemetryService.markClick(req.params.id, req.body?.clickedProductId);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

router.get('/popular', asyncHandler(async (req, res) => {
  const data = await telemetryService.getPopularData();
  res.json(data);
}));

router.get('/analytics', requireAdmin, asyncHandler(async (req, res) => {
  const analytics = await telemetryService.getAnalytics(req.query.days);
  res.json(analytics);
}));

router.get('/sessions', requireAdmin, asyncHandler(async (req, res) => {
  const sessions = await telemetryService.getSessions(req.query.days);
  res.json({ ok: true, sessions });
}));

router.get('/raw-searches', requireAdmin, asyncHandler(async (req, res) => {
  const searches = await telemetryService.getRawSearches(req.query.days);
  res.json({ ok: true, searches });
}));

module.exports = router;
