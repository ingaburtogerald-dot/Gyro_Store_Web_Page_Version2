// Recomprime las imágenes del catálogo YA subidas (crudas/pesadas) a WebP
// redimensionado, para que se vean/carguen igual que las demás.
//
// CONTEXTO
//   El endpoint de subida ahora optimiza (resize + WebP), pero lo subido ANTES
//   quedó crudo (ej. KZ EDX Pro: PNGs de 6.4 MB). Este script las descarga del
//   bucket, las optimiza, sube la versión .webp, actualiza las URLs en Firestore
//   y borra los archivos viejos.
//
// USO
//   node scripts/optimizeExistingImages.js            # DRY-RUN: reporta pesos, no escribe
//   node scripts/optimizeExistingImages.js --apply    # optimiza, actualiza docs y borra viejas
//
// Requiere `sharp` instalado en el server:  cd server && npm install sharp
// Idempotente: las que ya son .webp se saltan.

const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { admin, db, FieldValue } = require('../server/firebase');
const config = require('../server/config');
// Reusa el optimizador del server: así `sharp` se resuelve desde server/node_modules
// (donde lo instalaste), sin importar desde dónde corras este script.
const { uploadFile, deleteFileByUrl, optimizeImageBuffer, isSharpAvailable } = require('../server/services/storage');

const CATALOG = config.collections.catalog;
const APPLY = process.argv.includes('--apply');
const MAX_DIM = 1200;
const QUALITY = 82;

const bucket = admin.storage().bucket();
const PREFIX = `https://storage.googleapis.com/${bucket.name}/`;
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

function pathFromUrl(url) {
  if (!url || typeof url !== 'string' || !url.startsWith(PREFIX)) return null;
  return decodeURI(url.slice(PREFIX.length));
}

// Descarga, optimiza y (si APPLY) sube la nueva. Devuelve { newUrl, before, after }
// o null si la URL no es nuestra o ya está optimizada (.webp).
async function processUrl(url) {
  const p = pathFromUrl(url);
  if (!p || /\.webp$/i.test(p)) return null;      // externa o ya optimizada
  const [buf] = await bucket.file(p).download();
  const { buffer: optimized } = await optimizeImageBuffer(buf, { maxDim: MAX_DIM, quality: QUALITY });

  const base = p.split('/').pop().replace(/\.[^.]+$/, '');
  const newUrl = APPLY
    ? await uploadFile(optimized, 'catalog-images', `${base}.webp`, 'image/webp')
    : url; // en dry-run no subimos: solo medimos
  return { oldUrl: url, newUrl, before: buf.length, after: optimized.length };
}

async function run() {
  console.log(`\n🖼️  Optimización de imágenes existentes — modo ${APPLY ? 'APPLY (escribe)' : 'DRY-RUN'}\n`);

  if (!isSharpAvailable()) {
    console.error('❌ sharp no está instalado en el server. Corre:  cd server && npm install sharp\n');
    process.exit(1);
  }

  const snap = await db.collection(CATALOG).get();
  let totalBefore = 0, totalAfter = 0, changed = 0, docsTouched = 0;
  const toDelete = [];

  for (const doc of snap.docs) {
    const item = doc.data();
    const map = new Map(); // oldUrl → newUrl para reescribir el doc

    // Recolecta todas las URLs del ítem (images[] + imagesByColor{}).
    const allUrls = new Set([
      ...(Array.isArray(item.images) ? item.images : []),
      ...Object.values(item.imagesByColor || {}).flat(),
    ].filter(Boolean));

    for (const url of allUrls) {
      let r;
      try { r = await processUrl(url); }
      catch (e) { console.error(`   ⚠️  ${url.split('/').pop()}: ${e.message}`); continue; }
      if (!r) continue;
      map.set(r.oldUrl, r.newUrl);
      totalBefore += r.before; totalAfter += r.after; changed++;
      const pct = Math.round((1 - r.after / r.before) * 100);
      console.log(`   ${item.name}: ${r.oldUrl.split('/').pop()}  ${kb(r.before)} → ${kb(r.after)}  (−${pct}%)`);
      if (APPLY) toDelete.push(r.oldUrl);
    }

    if (map.size === 0) continue;
    docsTouched++;

    if (APPLY) {
      const newImages = (item.images || []).map((u) => map.get(u) || u);
      const newByColor = {};
      for (const [color, urls] of Object.entries(item.imagesByColor || {})) {
        newByColor[color] = (Array.isArray(urls) ? urls : []).map((u) => map.get(u) || u);
      }
      await doc.ref.update({
        images: newImages,
        imagesByColor: newByColor,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  // Borra los archivos viejos SOLO después de actualizar los docs.
  if (APPLY && toDelete.length) {
    console.log(`\n🧹 Borrando ${toDelete.length} archivos viejos…`);
    for (const url of toDelete) await deleteFileByUrl(url);
  }

  console.log(`\n📊 ${changed} imágenes en ${docsTouched} productos.`);
  if (changed) console.log(`   Peso total: ${kb(totalBefore)} → ${kb(totalAfter)}  (−${Math.round((1 - totalAfter / totalBefore) * 100)}%)`);
  console.log(`\n${APPLY ? '✅ Optimización aplicada. Refresca el catálogo (el caché del server se limpia al guardar).' : 'ℹ️  DRY-RUN. Reejecuta con --apply para escribir.'}\n`);

  // Limpia el caché del catálogo en el server en caliente no es posible desde aquí;
  // basta con reiniciar el api-server o editar/guardar cualquier producto.
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
