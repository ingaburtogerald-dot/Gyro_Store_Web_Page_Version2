const router = require('express').Router();
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const installmentsService = require('../services/installments');

router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const list = await installmentsService.getAllInstallments();
  res.json(list);
}));

router.get('/pending', requireAdmin, asyncHandler(async (req, res) => {
  const list = await installmentsService.getPendingInstallments();
  res.json(list);
}));

router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const installment = await installmentsService.createInstallment(req.body);
    res.status(201).json(installment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

router.post('/:id/payments', requireAdmin, asyncHandler(async (req, res) => {
  try {
    const result = await installmentsService.registerPayment(req.params.id, req.body, req.user.email);
    res.json({ ok: true, ...result });
  } catch (error) {
    const code = error.message.includes('encontrada') ? 404 : 400;
    res.status(code).json({ error: error.message });
  }
}));

router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  try {
    await installmentsService.cancelInstallment(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    const code = error.message.includes('encontrada') ? 404 : 400;
    res.status(code).json({ error: error.message });
  }
}));

module.exports = router;
