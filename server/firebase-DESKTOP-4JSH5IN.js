const admin = require('firebase-admin');
const config = require('./config');
const path = require('path');
const fs = require('fs');

try {
  let credential;

  // Opción A: JSON de credenciales en variable de entorno
  if (config.firebaseAdmin.serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(config.firebaseAdmin.serviceAccountJson);
      credential = admin.credential.cert(serviceAccount);
      console.log('🔑 Firebase Admin SDK: Cargado desde FIREBASE_SERVICE_ACCOUNT_JSON');
    } catch (e) {
      console.error('❌ Error parseando FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
    }
  }

  // Opción B: Ruta local a archivo serviceAccountKey.json
  if (!credential && config.firebaseAdmin.serviceAccountPath) {
    const absPath = path.resolve(process.cwd(), config.firebaseAdmin.serviceAccountPath);
    if (fs.existsSync(absPath)) {
      try {
        const serviceAccount = JSON.parse(fs.readFileSync(absPath, 'utf8'));
        credential = admin.credential.cert(serviceAccount);
        console.log(`🔑 Firebase Admin SDK: Cargado desde archivo local: ${config.firebaseAdmin.serviceAccountPath}`);
      } catch (e) {
        console.error(`❌ Error leyendo archivo local de credenciales (${absPath}):`, e.message);
      }
    }
  }

  // Fallback si no hay credenciales (intenta Application Default Credentials)
  if (!credential) {
    console.warn('⚠️ No se encontraron credenciales explícitas de Firebase. Se intentarán usar las credenciales por defecto de Google Cloud/Render.');
    credential = admin.credential.applicationDefault();
  }

  const storageBucket = config.firebaseWeb?.storageBucket || `${config.firebaseWeb?.projectId}.appspot.com`;

  admin.initializeApp({
    credential,
    storageBucket,
  });

  console.log('🔥 Firebase Admin SDK inicializado correctamente.');
} catch (error) {
  console.error('❌ Error fatal al inicializar Firebase Admin SDK:', error.message);
}

module.exports = {
  admin,
  auth: admin.auth(),
  db: admin.firestore(),
  bucket: admin.storage().bucket(),
  FieldValue: admin.firestore.FieldValue,
};
