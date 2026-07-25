const { auth, db } = require('../firebase');
const config = require('../config');
const storage = require('./storage');

async function changePassword(uid, email, newPassword) {
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
  }

  // 1. Actualiza en Firebase Authentication
  await auth.updateUser(uid, { password: newPassword });

  // 2. Quita la bandera de cambio obligatorio en Firestore
  const snap = await db.collection(config.collections.users)
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .get();

  if (!snap.empty) {
    await snap.docs[0].ref.update({ mustChangePassword: false });
  }
}

async function uploadPhoto(uid, email, fileBuffer, originalname, mimetype) {
  if (!mimetype || !mimetype.startsWith('image/')) {
    throw new Error('El archivo debe ser una imagen.');
  }

  const ext = (originalname.match(/\.[^.]+$/) || ['.jpg'])[0];
  const photoURL = await storage.uploadFile(
    fileBuffer,
    storage.folders.profilePhoto(uid),
    `${Date.now()}${ext}`,
    mimetype
  );

  // 1. Actualiza la foto en Firebase Authentication
  await auth.updateUser(uid, { photoURL });

  // 2. Refleja la foto en el documento del usuario en Firestore
  const snap = await db.collection(config.collections.users)
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .get();
    
  if (!snap.empty) {
    await snap.docs[0].ref.update({ photoURL });
  }

  return photoURL;
}

async function updateWhatsapp(email, whatsapp) {
  if (typeof whatsapp !== 'string') {
    throw new Error('Número de WhatsApp inválido.');
  }

  const snap = await db.collection(config.collections.users)
    .where('email', '==', email.toLowerCase())
    .limit(1)
    .get();

  if (!snap.empty) {
    await snap.docs[0].ref.update({ whatsapp });
  }
}

module.exports = {
  changePassword,
  uploadPhoto,
  updateWhatsapp,
};
