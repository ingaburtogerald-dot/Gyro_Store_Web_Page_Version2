const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { db } = require('../server/firebase');
const config = require('../server/config');

async function run() {
  console.log('Buscando productos con descripción "Prueba 1"...');
  const catalogRef = db.collection(config.collections.catalog);
  const snap = await catalogRef.get();
  
  const batch = db.batch();
  let count = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.templateId) {
      const tplDoc = await db.collection(config.collections.templates).doc(data.templateId).get();
      if (tplDoc.exists) {
        const tplData = tplDoc.data();
        let updateData = {};
        
        if (tplData.description && tplData.description !== data.description) {
          updateData.description = tplData.description;
        }
        
        if (tplData.specs) {
          updateData.specs = tplData.specs;
        }

        if (Object.keys(updateData).length > 0) {
          batch.update(doc.ref, updateData);
          count++;
          console.log(`Actualizado: ${data.name}`);
        }
      }
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`✅ Se actualizaron ${count} productos con la descripción de sus plantillas.`);
  } else {
    console.log('✅ No se encontraron productos con la descripción "Prueba 1".');
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
