const { db } = require('../../server/firebase');
const config = require('../../server/config');

const COL = config.collections.analyticsEvents || 'analytics_events';

async function deleteRootVisits() {
  console.log(`Buscando visitas a "/" en la colección: ${COL}`);
  
  try {
    const snapshot = await db.collection(COL)
      .where('type', '==', 'pageview')
      .where('page', '==', '/')
      .get();
      
    if (snapshot.empty) {
      console.log('No se encontraron visitas a "/" para eliminar.');
      process.exit(0);
    }
    
    console.log(`Encontrados ${snapshot.size} documentos. Procediendo a eliminar...`);
    
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`¡Eliminados ${snapshot.size} documentos exitosamente!`);
    process.exit(0);
  } catch (error) {
    console.error('Error al eliminar documentos:', error);
    process.exit(1);
  }
}

deleteRootVisits();
