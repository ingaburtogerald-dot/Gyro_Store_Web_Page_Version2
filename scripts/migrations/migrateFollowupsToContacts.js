// Migra la colección legacy `followups` al modelo CRM v2 `contacts` + subcolección
// `activities`. Cada followup se convierte en un contacto; su `note` pasa a ser la
// primera actividad del historial. Idempotente: marca cada followup con
// `migratedToContactId` y salta los ya migrados. NO borra los followups.
//
//   node scripts/migrateFollowupsToContacts.js          (dry-run: solo cuenta)
//   node scripts/migrateFollowupsToContacts.js --commit (escribe de verdad)
//
const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { db, FieldValue, Timestamp } = require('../../server/firebase');
const config = require('../../server/config');

const FOLLOWUPS = config.collections.followups;
const CONTACTS = config.collections.contacts;
const COMMIT = process.argv.includes('--commit');

// followUpDate legacy es "YYYY-MM-DD" (sin hora). Lo interpretamos como 09:00 local.
function ymdToTimestamp(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  return Timestamp.fromDate(new Date(y, m - 1, d, 9, 0, 0));
}

// status legacy → etapa del embudo. `pending` arranca como lead nuevo.
function stageFromStatus(status) {
  if (status === 'done') return 'won';
  if (status === 'lost') return 'lost';
  return 'new';
}

// type legacy → type de actividad.
const ACTIVITY_TYPE = { callback: 'call', restock: 'restock', other: 'note' };

async function run() {
  const snap = await db.collection(FOLLOWUPS).get();
  console.log(`\n📋 ${snap.size} followups encontrados. Modo: ${COMMIT ? 'COMMIT' : 'DRY-RUN'}\n`);

  let migrated = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const f = doc.data();
    if (f.migratedToContactId) {
      skipped++;
      continue;
    }

    const stage = stageFromStatus(f.status);
    const dueAt = f.status === 'pending' ? ymdToTimestamp(f.followUpDate) : null;

    const contact = {
      name: f.customerName || 'Sin nombre',
      phone: f.customerPhone || '',
      email: '',
      product: f.product || '',
      source: 'migrated_followup',
      value: 0,
      tags: [],
      stage,
      stageOrder: f.createdAt?.toMillis?.() || Date.now(),
      nextActivityAt: dueAt,
      lastActivityAt: f.updatedAt || f.createdAt || null,
      ownerUid: f.ownerUid || '',
      ownerEmail: f.ownerEmail || '',
      ownerName: f.ownerName || (f.ownerEmail ? f.ownerEmail.split('@')[0] : 'Desconocido'),
      createdAt: f.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    console.log(`  • ${contact.name}  [${stage}]  owner=${contact.ownerEmail}`);

    if (COMMIT) {
      const contactRef = db.collection(CONTACTS).doc();
      const batch = db.batch();
      batch.set(contactRef, contact);

      // La nota original se conserva como la primera actividad del historial.
      if (f.note || f.product) {
        const actRef = contactRef.collection('activities').doc();
        batch.set(actRef, {
          type: ACTIVITY_TYPE[f.type] || 'note',
          body: f.note || `Producto de interés: ${f.product}`,
          outcome: null,
          dueAt,
          done: stage !== 'new',
          authorEmail: contact.ownerEmail,
          authorName: contact.ownerName,
          createdAt: f.createdAt || FieldValue.serverTimestamp(),
        });
      }

      // Marca de idempotencia en el followup legacy (no lo borra).
      batch.update(doc.ref, { migratedToContactId: contactRef.id });
      await batch.commit();
    }
    migrated++;
  }

  console.log(`\n✅ ${migrated} migrados, ${skipped} ya estaban migrados.`);
  if (!COMMIT) console.log('   (dry-run: no se escribió nada. Reejecuta con --commit)\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Error en la migración:', err);
  process.exit(1);
});
