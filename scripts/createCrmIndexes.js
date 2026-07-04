// Crea los índices compuestos del CRM v2 vía la Firestore Admin REST API, usando el
// service account ya configurado (sin depender del Firebase CLI). Idempotente: si un
// índice ya existe (409 ALREADY_EXISTS) lo salta. Fuente declarativa: firestore.indexes.json
//
//   node scripts/createCrmIndexes.js
//
const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { admin } = require('../server/firebase');
const config = require('../server/config');

const PROJECT = config.firebaseWeb.projectId;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/collectionGroups`;

// Mismos índices que firestore.indexes.json (el __name__ final es implícito en la API).
const INDEXES = [
  {
    collectionGroup: 'contacts',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'ownerEmail', order: 'ASCENDING' },
      { fieldPath: 'stage', order: 'ASCENDING' },
      { fieldPath: 'stageOrder', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collectionGroup: 'contacts',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'stage', order: 'ASCENDING' },
      { fieldPath: 'stageOrder', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' },
    ],
  },
  {
    collectionGroup: 'contacts',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'ownerEmail', order: 'ASCENDING' },
      { fieldPath: 'nextActivityAt', order: 'ASCENDING' },
    ],
  },
  {
    collectionGroup: 'activities',
    queryScope: 'COLLECTION_GROUP',
    fields: [
      { fieldPath: 'authorEmail', order: 'ASCENDING' },
      { fieldPath: 'done', order: 'ASCENDING' },
      { fieldPath: 'dueAt', order: 'ASCENDING' },
    ],
  },
];

async function run() {
  const { access_token } = await admin.app().options.credential.getAccessToken();
  console.log(`\n🔧 Creando ${INDEXES.length} índices en ${PROJECT}\n`);

  for (const idx of INDEXES) {
    const { collectionGroup, queryScope, fields } = idx;
    const label = `${collectionGroup} [${fields.map((f) => f.fieldPath).join(', ')}]`;
    const res = await fetch(`${BASE}/${collectionGroup}/indexes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ queryScope, fields }),
    });

    if (res.ok) {
      console.log(`  ✅ creado:  ${label}`);
    } else {
      const body = await res.json().catch(() => ({}));
      const msg = body.error?.message || '';
      if (res.status === 409 || /already exists/i.test(msg)) {
        console.log(`  ↔️  ya existe: ${label}`);
      } else {
        console.log(`  ❌ error (${res.status}): ${label} → ${msg}`);
      }
    }
  }

  console.log('\n⏳ Los índices tardan un momento en pasar de CREATING a READY (colección chica ≈ instantáneo).');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Error creando índices:', err);
  process.exit(1);
});
