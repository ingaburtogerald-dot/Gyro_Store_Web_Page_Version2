// Mantenimiento del catálogo:
//   1. Desduplica las URLs de imágenes en Firestore (images[] e imagesByColor{}).
//   2. Busca archivos huérfanos en Cloudflare R2 (subidos pero ya no referenciados
//      por ningún producto) y los borra para no pagar/acumular basura.
//
// USO
//   node scripts/cleanupStorage.js
const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { db } = require('../server/firebase');
const config = require('../server/config');
const storage = require('../server/services/storage');

async function run() {
  console.log('🔍 Iniciando limpieza de R2 y optimización de base de datos...');

  // 1. Obtener todos los productos del catálogo
  const catalogRef = db.collection(config.collections.catalog);
  const snap = await catalogRef.get();

  const usedUrls = new Set();
  const batch = db.batch();
  let updatedDocsCount = 0;

  snap.docs.forEach((doc) => {
    const data = doc.data();
    let needsUpdate = false;
    const updateData = {};

    // Arreglar duplicados en imagesByColor
    if (data.imagesByColor) {
      const newImagesByColor = {};
      for (const [color, urls] of Object.entries(data.imagesByColor)) {
        if (Array.isArray(urls)) {
          // Eliminar duplicados manteniendo el orden
          const uniqueUrls = [...new Set(urls)];
          newImagesByColor[color] = uniqueUrls;
          uniqueUrls.forEach(url => usedUrls.add(url));

          if (uniqueUrls.length !== urls.length) {
            needsUpdate = true;
          }
        }
      }
      if (needsUpdate) {
        updateData.imagesByColor = newImagesByColor;
      }
    }

    // Arreglar duplicados en images (por si acaso quedaron)
    if (Array.isArray(data.images)) {
      const uniqueImages = [...new Set(data.images)];
      uniqueImages.forEach(url => usedUrls.add(url));

      if (uniqueImages.length !== data.images.length) {
        updateData.images = uniqueImages;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      batch.update(doc.ref, updateData);
      updatedDocsCount++;
    }
  });

  if (updatedDocsCount > 0) {
    await batch.commit();
    console.log(`✅ Se corrigieron fotos duplicadas en ${updatedDocsCount} productos.`);
  } else {
    console.log('✅ No se encontraron fotos duplicadas en los productos.');
  }

  // 2. Revisar Cloudflare R2 para buscar huérfanos
  const files = await storage.listFiles('catalog-images/');

  let deletedFilesCount = 0;
  let totalBytesDeleted = 0;

  console.log(`\n📦 Analizando ${files.length} archivos en R2...`);

  for (const file of files) {
    // file.url es la misma URL pública que se guarda en la base de datos.
    if (!usedUrls.has(file.url)) {
      await storage.deleteFileByUrl(file.url);
      deletedFilesCount++;
      totalBytesDeleted += file.size;
      console.log(`🗑️ Eliminado huérfano: ${file.key}`);
    }
  }

  const mbDeleted = (totalBytesDeleted / (1024 * 1024)).toFixed(2);
  console.log(`\n🎉 Limpieza finalizada. Se eliminaron ${deletedFilesCount} archivos huérfanos (${mbDeleted} MB liberados).`);
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Error en el script de limpieza:', err);
  process.exit(1);
});
