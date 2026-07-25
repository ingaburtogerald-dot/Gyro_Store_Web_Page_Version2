// Siembra el admin general local por defecto del sistema (para empezar pruebas).
// Crea/actualiza la cuenta en Firebase Auth y su documento en Firestore con rol
// global_admin. Idempotente: se puede ejecutar varias veces sin duplicar.
//
//   node scripts/seedAdmin.js
//
const path = require('path');
// firebase.js resuelve las credenciales relativas a process.cwd(): forzamos la raíz.
process.chdir(path.join(__dirname, '..'));

const { auth, db, FieldValue } = require('../../server/firebase');
const config = require('../../server/config');

const DEFAULT_ADMIN = {
  email: 'dev-admin@gyrostore.com',
  password: 'admin1',
  displayName: 'Admin General',
  roles: ['global_admin'],
};

async function run() {
  const email = DEFAULT_ADMIN.email.toLowerCase();

  // 1. Cuenta en Firebase Auth (crear o actualizar contraseña).
  let uid;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    await auth.updateUser(uid, {
      password: DEFAULT_ADMIN.password,
      displayName: DEFAULT_ADMIN.displayName,
      emailVerified: true,
      disabled: false,
    });
    console.log('✓ Cuenta de Auth actualizada.');
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const created = await auth.createUser({
        email,
        password: DEFAULT_ADMIN.password,
        displayName: DEFAULT_ADMIN.displayName,
        emailVerified: true,
      });
      uid = created.uid;
      console.log('✓ Cuenta de Auth creada.');
    } else {
      throw err;
    }
  }

  // 2. Documento en Firestore (la fuente de verdad de los roles).
  const snap = await db.collection(config.collections.users).where('email', '==', email).limit(1).get();
  const data = {
    uid,
    email,
    displayName: DEFAULT_ADMIN.displayName,
    provider: 'local',
    roles: DEFAULT_ADMIN.roles,
    photoURL: '',
    isProtected: false,
    deletedAt: null,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (snap.empty) {
    await db.collection(config.collections.users).add({ ...data, createdAt: FieldValue.serverTimestamp() });
    console.log('✓ Documento de usuario creado en Firestore.');
  } else {
    await snap.docs[0].ref.update(data);
    console.log('✓ Documento de usuario actualizado en Firestore.');
  }

  console.log('\n✅ Admin general listo:');
  console.log(`   Correo:     ${email}`);
  console.log(`   Contraseña: ${DEFAULT_ADMIN.password}`);
  console.log(`   Rol:        global_admin\n`);
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Error al sembrar el admin:', err.message);
  process.exit(1);
});
