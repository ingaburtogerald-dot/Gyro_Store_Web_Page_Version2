const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { admin, db } = require('../server/firebase');
const config = require('../server/config');

async function run() {
  console.log('🔍 Iniciando limpieza de Storage y optimización de base de datos...');

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

  // 2. Revisar Firebase Storage para buscar huérfanos
  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles({ prefix: 'catalog-images/' });
  
  let deletedFilesCount = 0;
  let totalBytesDeleted = 0;

  console.log(`\n📦 Analizando ${files.length} archivos en Storage...`);

  for (const file of files) {
    // Generar la misma URL que se guarda en la base de datos
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURI(file.name)}`;
    
    if (!usedUrls.has(publicUrl)) {
      const [metadata] = await file.getMetadata();
      const size = Number(metadata.size) || 0;
      
      await file.delete();
      deletedFilesCount++;
      totalBytesDeleted += size;
      console.log(`🗑️ Eliminado huérfano: ${file.name}`);
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
