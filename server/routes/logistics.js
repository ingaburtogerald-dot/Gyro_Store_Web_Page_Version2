const router = require('express').Router();
const { requireLogisticsAdmin, requireLogisticsAny } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { imageOrPdfUpload } = require('../utils/upload');
const logisticsService = require('../services/logistics');

const upload = imageOrPdfUpload({ maxSizeMb: 8 });

router.get('/shipments', requireLogisticsAny, asyncHandler(async (req, res) => {
  const shipments = await logisticsService.getShipments(req.user);
  res.json(shipments);
}));

router.post(
  '/shipments',
  requireLogisticsAny,
  upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'invoiceFile', maxCount: 1 }]),
  asyncHandler(async (req, res) => {
    try {
      const shipment = await logisticsService.createShipment(req.body, req.files, req.user);
      res.status(201).json(shipment);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  })
);

router.patch('/shipments/:id/deliver-china', requireLogisticsAny, asyncHandler(async (req, res) => {
  try {
    const result = await logisticsService.markDeliveredInChina(req.params.id, req.body.comment, req.user);
    res.json(result);
  } catch (error) {
    const code = error.message.includes('encontrado') ? 404 : (error.message.includes('No puedes modificar') ? 403 : 400);
    res.status(code).json({ error: error.message });
  }
}));

router.patch('/shipments/:id/receive-china', requireLogisticsAdmin, asyncHandler(async (req, res) => {
  try {
    const result = await logisticsService.markReceivedInChina(req.params.id, req.body.comment, req.user);
    res.json(result);
  } catch (error) {
    const code = error.message.includes('encontrado') ? 404 : 400;
    res.status(code).json({ error: error.message });
  }
}));

router.patch(
  '/shipments/:id/receive-nicaragua',
  requireLogisticsAdmin,
  upload.single('arrivalPhoto'),
  asyncHandler(async (req, res) => {
    try {
      const result = await logisticsService.markReceivedInNicaragua(req.params.id, req.body, req.file, req.user);
      res.json(result);
    } catch (error) {
      const code = error.message.includes('encontrado') ? 404 : 400;
      res.status(code).json({ error: error.message });
    }
  })
);

module.exports = router;
