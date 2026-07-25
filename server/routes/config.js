const router = require('express').Router();
const { requireSeller, requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const { mediaUpload } = require('../utils/upload');
const configService = require('../services/config');

const logoUpload = mediaUpload({ maxSizeMb: 25 });
const slideUpload = mediaUpload({ maxSizeMb: 50 });

router.get('/', asyncHandler(async (req, res) => {
  const publicConfig = await configService.getPublicConfig();
  res.json(publicConfig);
}));

router.get('/pricing', requireSeller, asyncHandler(async (req, res) => {
  const pricing = await configService.getPricing();
  res.json(pricing);
}));

router.put('/pricing', requireAdmin, asyncHandler(async (req, res) => {
  try {
    await configService.setPricing(req.body.wholesaleDiscounts);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

router.put('/categories', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const categories = await configService.setCategories(req.body.categories);
    res.json({ ok: true, categories });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

router.get('/business', requireAdmin, asyncHandler(async (req, res) => {
  const business = await configService.getBusiness();
  res.json(business);
}));

router.put('/costos-fijos', requireAdmin, asyncHandler(async (req, res) => {
  try {
    await configService.setCostosFijos(req.body);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

router.put('/business', requireAdmin, asyncHandler(async (req, res) => {
  try {
    await configService.setBusiness(req.body);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

router.get('/full', requireAdmin, asyncHandler(async (req, res) => {
  const fullConfig = await configService.getFullConfig();
  res.json(fullConfig);
}));

const uploadImageHandler = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo.' });
  const result = await configService.uploadImage(req.file, req.body.kind);
  res.json({ ok: true, ...result });
});

const deleteImageHandler = asyncHandler(async (req, res) => {
  const result = await configService.deleteImage(req.query.kind);
  res.json({ ok: true, ...result });
});

router.post('/image', requireAdmin, logoUpload.single('file'), uploadImageHandler);
router.delete('/image', requireAdmin, deleteImageHandler);
router.post('/logo', requireAdmin, logoUpload.single('file'), uploadImageHandler);
router.delete('/logo', requireAdmin, deleteImageHandler);

router.get('/landing_page', asyncHandler(async (req, res) => {
  const landing = await configService.getLandingPage();
  res.json(landing);
}));

router.put('/landing_page', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const result = await configService.setLandingPage(req.body || {});
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

router.post('/hero-slide', requireAdmin, slideUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo.' });
  const result = await configService.uploadHeroSlide(req.file, req.body.slideId);
  res.json({ ok: true, ...result });
}));

module.exports = router;
module.exports.clearConfigCache = configService.clearConfigCache;

