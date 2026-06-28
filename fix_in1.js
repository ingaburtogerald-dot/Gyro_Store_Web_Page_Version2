const { db, FieldValue } = require('./server/firebase');

async function fixTestSale() {
  console.log('Buscando compras con code IN1...');
  const purchasesSnap = await db.collection('purchases').where('code', '==', 'IN1').get();
  
  if (purchasesSnap.empty) {
    console.log('No se encontró la compra IN1 en purchases.');
  } else {
    for (const doc of purchasesSnap.docs) {
      console.log(`Reseteando quantitySold a 0 en purchase ${doc.id}`);
      await doc.ref.update({
        quantitySold: 0,
        quantityReserved: 0
      });
    }
  }

  console.log('\nBuscando órdenes (ventas) que contengan IN1...');
  const ordersSnap = await db.collection('orders').get();
  let deletedCount = 0;

  for (const doc of ordersSnap.docs) {
    const data = doc.data();
    let hasIN1 = false;
    
    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        if (item.code === 'IN1') hasIN1 = true;
      }
    }
    
    if (hasIN1) {
      console.log(`Borrando orden de prueba ${doc.id} (status: ${data.status})`);
      await doc.ref.delete();
      deletedCount++;
    }
  }
  
  console.log(`\n¡Listo! Órdenes de prueba borradas: ${deletedCount}`);
  process.exit(0);
}

fixTestSale().catch(console.error);
