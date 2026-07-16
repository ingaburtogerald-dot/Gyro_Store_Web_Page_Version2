// Inicialización de Firebase Admin SDK (solo servidor).
// Credenciales desde FIREBASE_SERVICE_ACCOUNT_JSON (env) o un archivo local.
const admin = require('firebase-admin');
const { getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');
const config = require('./config');

function init() {
  if (getApps().length) return admin;

  const keyPath = path.resolve(__dirname, config.serviceAccountPath);

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      console.log(`🔑 Firebase Admin inicializado (env): ${serviceAccount.project_id}`);
    } catch (e) {
      console.error('❌ Error al parsear FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
      process.exit(1);
    }
  } else if (fs.existsSync(keyPath)) {
    const serviceAccount = require(keyPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log(`🔑 Firebase Admin inicializado (archivo): ${serviceAccount.project_id}`);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp();
    console.log('🔑 Firebase Admin inicializado con GOOGLE_APPLICATION_CREDENTIALS');
  } else {
    console.error('\n❌ No se encontró el archivo de credenciales de Firebase.');
    console.error(`   Buscado en: ${keyPath}`);
    console.error('   Firebase Console → Configuración → Cuentas de servicio → Generar nueva clave privada');
    console.error('   Guárdalo como server/serviceAccountKey.json o usa FIREBASE_SERVICE_ACCOUNT_JSON.\n');
    process.exit(1);
  }

  return admin;
}

const app = init();
const db = getFirestore();
const auth = admin.auth();

module.exports = { admin: app, db, auth, FieldValue, Timestamp };
