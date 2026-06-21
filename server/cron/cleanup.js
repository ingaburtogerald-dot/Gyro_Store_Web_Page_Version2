// Tareas programadas. Por ahora: purga diaria de la papelera de usuarios cuyo
// periodo de retención (30 días) ya expiró.
const cron = require('node-cron');
const { db, auth } = require('../firebase');
const config = require('../config');

const TRASH = config.collections.usersDeleted;

async function purgeExpiredUsers() {
  const cutoff = new Date();
  const snap = await db.collection(TRASH).where('expiresAt', '<', cutoff).get();
  if (snap.empty) return;

  for (const doc of snap.docs) {
    const data = doc.data();
    try {
      if (data.uid) await auth.deleteUser(data.uid);
      else if (data.email) {
        const rec = await auth.getUserByEmail(String(data.email).toLowerCase());
        await auth.deleteUser(rec.uid);
      }
    } catch (err) {
      if (err.code !== 'auth/user-not-found') console.error('cron purge:', err.message);
    }
    await doc.ref.delete();
  }
  console.log(`🧹 Papelera: ${snap.size} usuario(s) purgado(s) por retención.`);
}

function startCronJobs() {
  // Todos los días a las 3:00 AM.
  cron.schedule('0 3 * * *', () => {
    purgeExpiredUsers().catch((e) => console.error('cron cleanup error:', e.message));
  });
  console.log('⏰ Cron jobs programados (limpieza diaria 03:00).');
}

module.exports = { startCronJobs, purgeExpiredUsers };
