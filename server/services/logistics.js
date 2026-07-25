const { db, FieldValue } = require('../firebase');
const config = require('../config');
const storage = require('./storage');
const { sendLogisticsAdminAlert, sendLogisticsValidateAlert, sendLogisticsStatusEmail } = require('./email');

const SHIPMENTS = config.collections.logisticsShipments;
const STATUS_FLOW = ['compra_registrada', 'entregado_china', 'recibido_china', 'recibido_nicaragua'];

const isAdminLike = (roles = []) =>
  roles.includes('admin') || roles.includes('global_admin') || roles.includes('logistics_admin');

const idxOf = (status) => STATUS_FLOW.indexOf(status);
const addDays = (date, n) => new Date(date.getTime() + n * 86400000).toISOString().split('T')[0];

async function adminEmails() {
  const snap = await db.collection(config.collections.users)
    .where('roles', 'array-contains-any', ['admin', 'global_admin', 'logistics_admin'])
    .get();
  return [...new Set([...snap.docs.map((d) => d.data().email).filter(Boolean), ...config.adminEmails])];
}

async function getShipments(user) {
  let docs;
  if (isAdminLike(user.roles)) {
    docs = (await db.collection(SHIPMENTS).orderBy('createdAt', 'desc').get()).docs;
  } else {
    const snap = await db.collection(SHIPMENTS).where('customerEmail', '==', user.email).get();
    docs = snap.docs.sort((a, b) => (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0));
  }
  return docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString() || null }));
}

async function createShipment(body, files, user) {
  const { trackingNumber, providerName, providerPhone, providerPhoneCode, purchaseDate } = body || {};
  const photo = files?.photo?.[0];
  if (!photo) throw new Error('La foto del paquete es obligatoria.');
  if (!trackingNumber?.trim()) throw new Error('El tracking es obligatorio.');

  const slug = storage.sanitizePathSegment(user.name || user.email.split('@')[0]);
  const folder = storage.folders.logisticsShipment(slug);
  const uploadFile = async (file) =>
    file
      ? storage.uploadFile(file.buffer, folder, `${Date.now()}-${file.fieldname}${(file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0]}`, file.mimetype)
      : '';

  const [photoUrl, invoiceFileUrl] = await Promise.all([uploadFile(photo), uploadFile(files?.invoiceFile?.[0])]);

  const data = {
    customerEmail: user.email,
    customerName: user.name || user.email.split('@')[0],
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

  adminEmails()
    .then((emails) => {
      if (emails.length) sendLogisticsAdminAlert({ toEmails: emails, customerName: data.customerName, trackingNumber: data.trackingNumber, purchaseDate: data.purchaseDate, photoUrl }).catch(() => {});
    })
    .catch(() => {});

  return { id: ref.id, ...data };
}

async function markDeliveredInChina(id, commentRaw, user) {
  const ref = db.collection(SHIPMENTS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Paquete no encontrado.');
  const current = snap.data();

  const admin = isAdminLike(user.roles);
  if (!admin && current.customerEmail !== user.email) {
    throw new Error('No puedes modificar este paquete.');
  }
  if (current.status !== 'compra_registrada') {
    throw new Error('Este paquete ya fue marcado como entregado en China.');
  }

  const comment = String(commentRaw || '').trim();
  const entry = { status: 'entregado_china', comment, timestamp: new Date().toISOString(), by: user.email };
  await ref.update({ status: 'entregado_china', updatedAt: FieldValue.serverTimestamp(), history: FieldValue.arrayUnion(entry) });

  adminEmails()
    .then((emails) => {
      if (emails.length) sendLogisticsValidateAlert({ toEmails: emails, customerName: current.customerName, trackingNumber: current.trackingNumber }).catch(() => {});
    })
    .catch(() => {});

  return { id, status: 'entregado_china' };
}

async function markReceivedInChina(id, commentRaw, user) {
  const comment = String(commentRaw || '').trim();
  if (!comment) throw new Error('El comentario es obligatorio.');

  const ref = db.collection(SHIPMENTS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Paquete no encontrado.');
  const current = snap.data();
  if (idxOf(current.status) >= idxOf('recibido_china')) {
    throw new Error('Este paquete ya fue recibido en China.');
  }

  const now = new Date();
  const estimatedArrivalFrom = addDays(now, 45);
  const estimatedArrivalTo = addDays(now, 60);
  const entry = { status: 'recibido_china', comment, timestamp: now.toISOString(), by: user.email };

  await ref.update({
    status: 'recibido_china',
    estimatedArrivalFrom,
    estimatedArrivalTo,
    updatedAt: FieldValue.serverTimestamp(),
    history: FieldValue.arrayUnion(entry),
  });
  sendLogisticsStatusEmail({ to: current.customerEmail, customerName: current.customerName, status: 'recibido_china', comment }).catch(() => {});

  return { id, status: 'recibido_china', estimatedArrivalFrom, estimatedArrivalTo };
}

async function markReceivedInNicaragua(id, body, file, user) {
  const ref = db.collection(SHIPMENTS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Paquete no encontrado.');
  const current = snap.data();
  if (current.status !== 'recibido_china') {
    throw new Error('El paquete debe estar recibido en China antes de llegar a Nicaragua.');
  }

  const comment = String(body.comment || '').trim();
  const shippingCost = Number(body.shippingCost);
  const shippingCurrency = body.shippingCurrency === 'USD' ? 'USD' : 'C$';
  if (!Number.isFinite(shippingCost) || shippingCost <= 0) {
    throw new Error('El costo total de envío es obligatorio.');
  }

  let arrivalPhotoUrl = current.arrivalPhotoUrl || '';
  if (file) {
    const slug = storage.sanitizePathSegment(current.customerName || current.customerEmail.split('@')[0]);
    const folder = storage.folders.logisticsShipment(slug);
    arrivalPhotoUrl = await storage.uploadFile(file.buffer, folder, `${Date.now()}-arrival${(file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0]}`, file.mimetype);
  }

  const entry = { status: 'recibido_nicaragua', comment, timestamp: new Date().toISOString(), by: user.email };
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

  return { id, status: 'recibido_nicaragua', shippingCost, shippingCurrency, arrivalPhotoUrl };
}

module.exports = {
  getShipments,
  createShipment,
  markDeliveredInChina,
  markReceivedInChina,
  markReceivedInNicaragua
};
