const router = require('express').Router();
const { requireSeller } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const crmService = require('../services/crm');

router.get('/agenda', requireSeller, asyncHandler(async (req, res) => {
  const items = await crmService.getAgenda(req.user);
  res.json(items);
}));

router.get('/', requireSeller, asyncHandler(async (req, res) => {
  const items = await crmService.getContacts(req.user, req.query.owner);
  res.json(items);
}));

router.post('/', requireSeller, asyncHandler(async (req, res) => {
  try {
    const contact = await crmService.createContact(req.body, req.user);
    res.status(201).json(contact);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}));

router.put('/:id', requireSeller, asyncHandler(async (req, res) => {
  try {
    const contact = await crmService.updateContact(req.params.id, req.body, req.user);
    res.json(contact);
  } catch (error) {
    const status = error.message.includes('encontrado') ? 404 : 
                   error.message.includes('No puedes') ? 403 : 400;
    res.status(status).json({ error: error.message });
  }
}));

router.patch('/:id/board', requireSeller, asyncHandler(async (req, res) => {
  try {
    await crmService.updateContactBoard(req.params.id, req.body || {}, req.user);
    res.json({ ok: true });
  } catch (error) {
    const status = error.message.includes('encontrado') ? 404 : 
                   error.message.includes('No puedes') ? 403 : 400;
    res.status(status).json({ error: error.message });
  }
}));

router.get('/:id/activities', requireSeller, asyncHandler(async (req, res) => {
  try {
    const activities = await crmService.getContactActivities(req.params.id, req.user);
    res.json(activities);
  } catch (error) {
    const status = error.message.includes('encontrado') ? 404 : 403;
    res.status(status).json({ error: error.message });
  }
}));

router.post('/:id/activities', requireSeller, asyncHandler(async (req, res) => {
  try {
    const activity = await crmService.addContactActivity(req.params.id, req.body, req.user);
    res.status(201).json(activity);
  } catch (error) {
    const status = error.message.includes('encontrado') ? 404 : 
                   error.message.includes('No puedes') ? 403 : 400;
    res.status(status).json({ error: error.message });
  }
}));

router.delete('/:id', requireSeller, asyncHandler(async (req, res) => {
  try {
    await crmService.deleteContact(req.params.id, req.user);
    res.json({ ok: true });
  } catch (error) {
    const status = error.message.includes('encontrado') ? 404 : 403;
    res.status(status).json({ error: error.message });
  }
}));

module.exports = router;
