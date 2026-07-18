// Gyro Logistics: los clientes registran paquetes comprados en China; marcan cuando el
// proveedor entrega en la bodega de China, y el equipo de logística valida la recepción
// en China y luego en Nicaragua (con email + notificación en cada paso).
const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const config = require('../config');
const { requireLogisticsAdmin, requireLogisticsAny } = require('../middleware/auth');
const { asyncHandler } = require('../utils/asyncHandler');
const storage = require('../services/storage');
const { sendLogisticsAdminAlert, sendLogisticsValidateAlert, sendLogisticsStatusEmail } = require('../services/email');
const { imageOrPdfUpload } = require('../utils/upload');

const SHIPMENTS = config.collections.logisticsShipments;
const STATUS_FLOW = ['compra_registrada', 'entregado_china', 'recibido_china', 'recibido_nicaragua'];
// La factura (invoiceFile) puede ser imagen o PDF; la foto del paquete es imagen.
const upload = imageOrPdfUpload({ maxSizeMb: 8 });

const isAdminLike = (roles = []) =>
  roles.includes('admin') || roles.includes('global_admin') || roles.includes('logistics_admin');

const idxOf = (status) => STATUS_FLOW.indexOf(status);
const addDays = (date, n) => new Date(date.getTime() + n * 86400000).toISOString().split('T')[0];

// Reúne los correos de todos los admins de logística (Firestore + whitelist por env).
async function adminEmails() {
  const snap = await db.collection(config.collections.users)
    .where('roles', 'array-contains-any', ['admin', 'global_admin', 'logistics_admin'])
    .get();
  return [...new Set([...snap.docs.map((d) => d.data().email).filter(Boolean), ...config.adminEmails])];
}

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

// POST /api/logistics/shipments — el cliente registra un paquete (foto + tracking obligatorios).
router.post(
  '/shipments',
  requireLogisticsAny,
  upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'invoiceFile', maxCount: 1 }]),
  asyncHandler(async (req, res) => {
    const { trackingNumber, providerName, providerPhone, providerPhoneCode, purchaseDate } = req.body || {};
    const photo = req.files?.photo?.[0];
    if (!photo) return res.status(400).json({ error: 'La foto del paquete es obligatoria.' });
    if (!trackingNumber?.trim()) return res.status(400).json({ error: 'El tracking es obligatorio.' });

    const slug = storage.sanitizePathSegment(req.user.name || req.user.email.split('@')[0]);
    const folder = storage.folders.logisticsShipment(slug);
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
      providerPhoneCode: String(providerPhoneCode || '+86').trim(),
      providerPhone: String(providerPhone || '').trim(),
      purchaseDate: String(purchaseDate || '').trim(),
      photoUrl,
      invoiceFileUrl,
      arrivalPhotoUrl: '',
      shippingCost: null,
      shippingCurrency: null,
      estimatedArrivalFrom: null,
      estimatedArrivalTo: null,
      status: 'compra_registrada',
      history: [{ status: 'compra_registrada', comment: '', timestamp: new Date().toISOString() }],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    const ref = await db.collection(SHIPMENTS).add(data);

    // Notifica a los admins de logística (sin bloquear la respuesta).
    adminEmails()
      .then((emails) => {
        if (emails.length) sendLogisticsAdminAlert({ toEmails: emails, customerName: data.customerName, trackingNumber: data.trackingNumber, purchaseDate: data.purchaseDate, photoUrl }).catch(() => {});
      })
      .catch(() => {});

    res.status(201).json({ id: ref.id, ...data });
  }),
);

// PATCH /shipments/:id/deliver-china — "Proveedor ya entregó" (cliente dueño o admin).
// compra_registrada → entregado_china. Notifica a los admins para que validen.
router.patch('/shipments/:id/deliver-china', requireLogisticsAny, asyncHandler(async (req, res) => {
  const ref = db.collection(SHIPMENTS).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Paquete no encontrado.' });
  const current = snap.data();

  const admin = isAdminLike(req.user.roles);
  if (!admin && current.customerEmail !== req.user.email) {
    return res.status(403).json({ error: 'No puedes modificar este paquete.' });
  }
  if (current.status !== 'compra_registrada') {
    return res.status(400).json({ error: 'Este paquete ya fue marcado como entregado en China.' });
  }

  const comment = String(req.body.comment || '').trim();
  const entry = { status: 'entregado_china', comment, timestamp: new Date().toISOString(), by: req.user.email };
  await ref.update({ status: 'entregado_china', updatedAt: FieldValue.serverTimestamp(), history: FieldValue.arrayUnion(entry) });

  // Avisa a los admins que hay una entrega por validar.
  adminEmails()
    .then((emails) => {
      if (emails.length) sendLogisticsValidateAlert({ toEmails: emails, customerName: current.customerName, trackingNumber: current.trackingNumber }).catch(() => {});
    })
    .catch(() => {});

  res.json({ id: req.params.id, status: 'entregado_china' });
}));

// PATCH /shipments/:id/receive-china — el admin valida la recepción en China (comentario
// obligatorio). Acepta venir desde compra_registrada o entregado_china. Fija la ventana
// de llegada estimada (45–60 días) y notifica al cliente.
router.patch('/shipments/:id/receive-china', requireLogisticsAdmin, asyncHandler(async (req, res) => {
  const comment = String(req.body.comment || '').trim();
  if (!comment) return res.status(400).json({ error: 'El comentario es obligatorio.' });

  const ref = db.collection(SHIPMENTS).doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) return res.status(404).json({ error: 'Paquete no encontrado.' });
  const current = snap.data();
  if (idxOf(current.status) >= idxOf('recibido_china')) {
    return res.status(400).json({ error: 'Este paquete ya fue recibido en China.' });
  }

  const now = new Date();
  const estimatedArrivalFrom = addDays(now, 45);
  const estimatedArrivalTo = addDays(now, 60);
  const entry = { status: 'recibido_china', comment, timestamp: now.toISOString(), by: req.user.email };

  await ref.update({
    status: 'recibido_china',
    estimatedArrivalFrom,
    estimatedArrivalTo,
    updatedAt: FieldValue.serverTimestamp(),
    history: FieldValue.arrayUnion(entry),
  });
  sendLogisticsStatusEmail({ to: current.customerEmail, customerName: current.customerName, status: 'recibido_china', comment }).catch(() => {});

  res.json({ id: req.params.id, status: 'recibido_china', estimatedArrivalFrom, estimatedArrivalTo });
}));

// PATCH /shipments/:id/receive-nicaragua — el admin confirma la llegada a Nicaragua con
// foto y costo total de envío (USD o C$). recibido_china → recibido_nicaragua.
router.patch(
  '/shipments/:id/receive-nicaragua',
  requireLogisticsAdmin,
  upload.single('arrivalPhoto'),
  asyncHandler(async (req, res) => {
    const ref = db.collection(SHIPMENTS).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Paquete no encontrado.' });
    const current = snap.data();
    if (current.status !== 'recibido_china') {
      return res.status(400).json({ error: 'El paquete debe estar recibido en China antes de llegar a Nicaragua.' });
    }

    const comment = String(req.body.comment || '').trim();
    const shippingCost = Number(req.body.shippingCost);
    const shippingCurrency = req.body.shippingCurrency === 'USD' ? 'USD' : 'C$';
    if (!Number.isFinite(shippingCost) || shippingCost <= 0) {
      return res.status(400).json({ error: 'El costo total de envío es obligatorio.' });
    }

    let arrivalPhotoUrl = current.arrivalPhotoUrl || '';
    if (req.file) {
      const slug = storage.sanitizePathSegment(current.customerName || current.customerEmail.split('@')[0]);
      const folder = storage.folders.logisticsShipment(slug);
      arrivalPhotoUrl = await storage.uploadFile(req.file.buffer, folder, `${Date.now()}-arrival${(req.file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0]}`, req.file.mimetype);
    }

    const entry = { status: 'recibido_nicaragua', comment, timestamp: new Date().toISOString(), by: req.user.email };
    await ref.update({
      status: 'recibido_nicaragua',
      arrivalPhotoUrl,
      shippingCost,
      shippingCurrency,
      updatedAt: FieldValue.serverTimestamp(),
      history: FieldValue.arrayUnion(entry),
    });
    sendLogisticsStatusEmail({
      to: current.customerEmail, customerName: current.customerName, status: 'recibido_nicaragua',
      comment, shippingCost, shippingCurrency, photoUrl: arrivalPhotoUrl,
    }).catch(() => {});

    res.json({ id: req.params.id, status: 'recibido_nicaragua', shippingCost, shippingCurrency, arrivalPhotoUrl });
  }),
);

module.exports = router;
