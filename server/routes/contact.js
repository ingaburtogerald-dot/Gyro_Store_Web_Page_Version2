// Formulario de contacto público → envía un email al admin.
const router = require('express').Router();
const config = require('../config');
const { asyncHandler } = require('../utils/asyncHandler');
const { contactSchema } = require('../utils/validators');
const { sendContactMessage } = require('../services/email');

// POST /api/contact
router.post('/', asyncHandler(async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Datos inválidos.' });
  }

  // Destinatario: el admin protegido o el primer admin de la whitelist.
  const to = config.protectedEmail || config.adminEmails[0] || config.email.user;
  if (!to) return res.status(503).json({ error: 'El contacto no está configurado.' });

  const sent = await sendContactMessage({ to, ...parsed.data });
  if (!sent) return res.status(503).json({ error: 'No se pudo enviar el mensaje en este momento.' });

  res.json({ ok: true });
}));

module.exports = router;
