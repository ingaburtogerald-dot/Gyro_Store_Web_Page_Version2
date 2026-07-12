// Migración: introduce el campo `sku` canónico en la colección `products` (bodega).
//
// CONTEXTO
//   Hoy cada doc de `products` es un LOTE con su propio `code` (IN13, IN98…). El
//   catálogo agrupaba "la misma variante en distintos lotes" mapeando una combo a
//   un ARRAY de códigos: variantMappings["Rojo / M"] = { skus: ["IN13","IN98"] }.
//   El rediseño 1-a-1 exige un SKU canónico que agrupe esos lotes, y que el stock
//   se sume por `sku` en el backend.
//
//   Esos arrays existentes SON la fuente de verdad de qué códigos van juntos. Este
//   script deriva los grupos de ahí y escribe `sku` en cada doc de `products`.
//
// QUÉ HACE
//   1. Default: cada producto sin agrupar recibe  sku = su propio code  (1 lote = 1 sku).
//   2. Grupos: por cada combo del catálogo con skus=[c1,c2,…], el sku canónico del
//      grupo = el PRIMER código (determinista y sin colisiones). Todos los códigos
//      del grupo reciben  sku = canónico.
//   3. (Opcional, --rewrite-catalog) reescribe variantMappings al formato nuevo
//      { sku, price? } apuntando al canónico, y elimina `availability`.
//
// USO
//   node scripts/migrateInventorySku.js               # DRY-RUN: solo reporta, no escribe
//   node scripts/migrateInventorySku.js --apply       # aplica el sku a products
//   node scripts/migrateInventorySku.js --apply --rewrite-catalog   # + reescribe catálogo
//
// Es idempotente: correrlo dos veces no daña nada (recomputa el mismo resultado).

const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { db, FieldValue } = require('../server/firebase');
const config = require('../server/config');

const PRODUCTS = config.collections.products;
const CATALOG = config.collections.catalog;

const APPLY = process.argv.includes('--apply');
const REWRITE_CATALOG = process.argv.includes('--rewrite-catalog');

// Lee los códigos de una entrada de variantMappings (formato viejo o nuevo).
function readCodes(entry) {
  if (!entry) return [];
  if (Array.isArray(entry.skus)) return entry.skus.filter(Boolean);
  if (entry.sku) return [entry.sku];
  return [];
}

// Sku canónico de un grupo de códigos. Determinista: el primero de la lista.
// (Se puede renombrar luego desde el UI de inventario; lo importante es agrupar.)
function canonicalSku(codes) {
  return codes[0];
}

// Commit en tandas (Firestore limita a 500 operaciones por batch).
async function commitInChunks(ops) {
  let done = 0;
  for (let i = 0; i < ops.length; i += 450) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + 450)) op(batch);
    await batch.commit();
    done += Math.min(450, ops.length - i);
    console.log(`   …${done}/${ops.length} escrituras confirmadas`);
  }
}

async function run() {
  console.log(`\n🔧 Migración de SKU canónico — modo ${APPLY ? 'APPLY (escribe)' : 'DRY-RUN (solo reporta)'}\n`);

  // 1) Índice de products por code → { ref, data }
  const prodSnap = await db.collection(PRODUCTS).get();
  const byCode = new Map();
  prodSnap.docs.forEach((d) => {
    const p = d.data();
    if (p.deletedAt) return;
    if (p.code) byCode.set(p.code, { ref: d.ref, data: p });
  });
  console.log(`📦 ${byCode.size} productos activos en bodega.`);

  // 2) Deriva los grupos desde los variantMappings del catálogo.
  const catSnap = await db.collection(CATALOG).get();
  const skuByCode = new Map();       // code → sku canónico
  const groups = [];                 // para el reporte
  const conflicts = [];              // un code que cae en dos grupos distintos

  catSnap.docs.forEach((doc) => {
    const item = doc.data();
    const mappings = item.variantMappings || {};
    for (const [combo, entry] of Object.entries(mappings)) {
      const codes = readCodes(entry).filter((c) => byCode.has(c)); // ignora códigos fantasma
      if (codes.length === 0) continue;
      const canon = canonicalSku(codes);
      groups.push({ item: item.name || doc.id, combo, codes, canon });
      for (const code of codes) {
        const prev = skuByCode.get(code);
        if (prev && prev !== canon) {
          conflicts.push({ code, kept: prev, ignored: canon, item: item.name, combo });
          continue; // conserva la primera asignación
        }
        skuByCode.set(code, canon);
      }
    }
  });

  // 3) Todo producto no agrupado → sku = su propio code.
  for (const code of byCode.keys()) {
    if (!skuByCode.has(code)) skuByCode.set(code, code);
  }

  // 4) Plan de escritura: solo docs cuyo sku cambiaría.
  const prodOps = [];
  let alreadyOk = 0;
  for (const [code, sku] of skuByCode.entries()) {
    const entry = byCode.get(code);
    if (!entry) continue;
    if (entry.data.sku === sku) { alreadyOk++; continue; }
    prodOps.push((batch) => batch.update(entry.ref, { sku }));
  }

  // ── Reporte ──
  const grouped = groups.filter((g) => g.codes.length > 1);
  console.log(`\n🔗 ${grouped.length} combinaciones agrupan >1 lote bajo un SKU:`);
  grouped.slice(0, 20).forEach((g) =>
    console.log(`   • ${g.item} · "${g.combo}"  →  sku "${g.canon}"  ⟵  [${g.codes.join(', ')}]`),
  );
  if (grouped.length > 20) console.log(`   …y ${grouped.length - 20} más.`);

  if (conflicts.length) {
    console.log(`\n⚠️  ${conflicts.length} códigos aparecían en DOS variantes distintas (revisar a mano):`);
    conflicts.slice(0, 15).forEach((c) =>
      console.log(`   • code ${c.code}: se mantiene sku "${c.kept}", se ignora "${c.ignored}" (${c.item} · ${c.combo})`),
    );
  }

  console.log(`\n📝 Products a actualizar: ${prodOps.length} (ya correctos: ${alreadyOk}).`);

  // 5) Escribe products.
  if (APPLY && prodOps.length) {
    console.log('\n💾 Escribiendo sku en products…');
    await commitInChunks(prodOps);
  }

  // 6) (Opcional) Reescribe el catálogo al formato nuevo { sku, price? } y borra availability.
  if (REWRITE_CATALOG) {
    const catOps = [];
    catSnap.docs.forEach((doc) => {
      const item = doc.data();
      const mappings = item.variantMappings || {};
      const next = {};
      let changed = false;
      for (const [combo, entry] of Object.entries(mappings)) {
        const codes = readCodes(entry).filter((c) => byCode.has(c));
        if (codes.length === 0) { changed = true; continue; } // descarta mapeos vacíos/fantasma
        const sku = canonicalSku(codes);
        const price = Number(entry.price);
        next[combo] = price > 0 ? { sku, price } : { sku };
        if (!entry.sku || entry.sku !== sku || Array.isArray(entry.skus)) changed = true;
      }
      if (item.availability !== undefined) changed = true;
      if (changed) {
        catOps.push((batch) =>
          batch.update(doc.ref, { variantMappings: next, availability: FieldValue.delete() }),
        );
      }
    });
    console.log(`\n🗂️  Ítems de catálogo a reescribir: ${catOps.length}.`);
    if (APPLY && catOps.length) {
      console.log('💾 Reescribiendo variantMappings del catálogo…');
      await commitInChunks(catOps);
    }
  }

  console.log(`\n${APPLY ? '✅ Migración aplicada.' : 'ℹ️  DRY-RUN terminado. Reejecuta con --apply para escribir.'}\n`);
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Error en la migración:', err);
  process.exit(1);
});
