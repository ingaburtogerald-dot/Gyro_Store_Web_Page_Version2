// Gyro Logistics: los clientes registran paquetes comprados en China; el equipo
// de logística avanza el estado hasta su llegada a Nicaragua (con email en cada paso).
const router = require('express').Router();
const multer = require('multer');
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireLogisticsAdmin, requireLogisticsAny } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const storage = require('../services/storage');
const { sendLogisticsAdminAlert, sendLogisticsStatusEmail } = require('../services/email');

const SHIPMENTS = config.collections.logisticsShipments;
const STATUS_FLOW = ['compra_registrada', 'recibido_china', 'recibido_nicaragua'];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const isAdminLike = (roles = []) =>
  roles.includes('admin') || roles.includes('global_admin') || roles.includes('logistics_admin');

// GET /api/logistics/shipments — admins ven todo; clientes solo lo suyo.
router.get('/shipments', requireLogisticsAny, asyncHandler(async (req, res) => {
  let docs;
  if (isAdminLike(req.user.roles)) {
    docs = (await db.collection(SHIPMENTS).orderBy('createdAt', 'desc').get()).docs;
  } else {
    const snap = await db.collection(SHIPMENTS).where('customerEmail', '==', req.user.email).get();
    docs = snap.docs.sort((a, b) => (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0));
  }
  res.json(docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString() || null })));
}));

// POST /api/logistics/shipments — el cliente registra un paquete (foto obligatoria).
router.post(
  '/shipments',
  requireLogisticsAny,
  upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'invoiceFile', maxCount: 1 }]),
  asyncHandler(async (req, res) => {
    const { trackingNumber, providerName, providerPhone, purchaseDate } = req.body || {};
    const photo = req.files?.photo?.[0];
    if (!photo) return res.status(400).json({ error: 'La foto del paquete es obligatoria.' });
    if (!trackingNumber?.trim()) return res.status(400).json({ error: 'El tracking es obligatorio.' });

    const slug = storage.sanitizePathSegment(req.user.name || req.user.email.split('@')[0]);
    const folder = `${config.collections.logisticsShipments}/${slug}`;
    const uploadFile = async (file) =>
      file
        ? storage.uploadFile(file.buffer, folder, `${Date.now()}-${file.fieldname}${(file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0]}`, file.mimetype)
        : '';

    const [photoUrl, invoiceFileUrl] = await Promise.all([uploadFile(photo), uploadFile(req.files?.invoiceFile?.[0])]);

    const data = {
      customerEmail: req.user.email,
      customerName: req.user.name || req.user.email.split('@')[0],
      trackingNumber: trackingNumber.trim(),
      providerName: String(providerName || '').trim(),
      providerPhone: String(providerPhone || '').trim(),
      purchaseDate: String(purchaseDate || '').trim(),
      photoUrl,
      invoiceFileUrl,
      status: 'compra_registrada',
      history: [{ status: 'compra_registrada', comment: '', timestamp: new Date().toISOString() }],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    const ref = await db.collection(SHIPMENTS).add(data);

    // Notifica a los admins de logística (sin bloquear la respuesta).
    db.collection(config.collections.users)
      .where('roles', 'array-contains-any', ['admin', 'global_admin', 'logistics_admin'])
      .get()
      .then((snap) => {
        const emails = [...new Set([...snap.docs.map((d) => d.data().email).filter(Boolean), ...config.adminEmails])];
        if (emails.length) {
          sendLogisticsAdminAlert({ toEmails: emails, customerName: data.customerName, trackingNumber: data.trackingNumber, purchaseDate: data.purchaseDate, photoUrl }).catch(() => {});
        }
      })
      .catch(() => {});

    res.status(201).json({ id: ref.id, ...data });
  }),
);

// PATCH /api/logistics/shipments/:id/advance — el admin avanza al siguiente estado.
router.patch('/shipments/:id/advance', requireLogisticsAdmin, asyncHandler(async (req, res) => {
  const comment = String(req.body.comment || '').trim();
  if (!comment) return res.status(400).json({ error: 'El comentario es obligatorio.' });

  const ref = db.collection(SHIPMENTS).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Paquete no encontrado.' });

  const current = snap.data();
  const idx = STATUS_FLOW.indexOf(current.status);
  if (idx === -1 || idx === STATUS_FLOW.length - 1) {
    return res.status(400).json({ error: 'El paquete ya está en su estado final.' });
  }
  const nextStatus = STATUS_FLOW[idx + 1];
  const entry = { status: nextStatus, comment, timestamp: new Date().toISOString() };

  await ref.update({ status: nextStatus, updatedAt: FieldValue.serverTimestamp(), history: FieldValue.arrayUnion(entry) });
  sendLogisticsStatusEmail({ to: current.customerEmail, customerName: current.customerName, status: nextStatus, comment }).catch(() => {});

  res.json({ id: req.params.id, status: nextStatus });
}));

module.exports = router;
