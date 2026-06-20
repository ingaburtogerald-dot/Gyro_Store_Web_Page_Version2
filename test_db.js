const { db } = require('./server/firebase');
const config = require('./server/config');

async function main() {
  console.log('=== PRODUCTS IN BODEGA ===');
  const prodSnap = await db.collection(config.collections.products).get();
  prodSnap.docs.forEach((doc) => {
    const data = doc.data();
    console.log(`ID: ${doc.id} | Code: ${data.code} | Name: ${data.name} | Stock: ${data.stock}`);
  });

  console.log('\n=== CATALOG ITEMS ===');
  const catSnap = await db.collection(config.collections.catalog).get();
  catSnap.docs.forEach((doc) => {
    const data = doc.data();
    console.log(`ID: ${doc.id} | Name: ${data.name} | Template: ${data.templateId || '—'} | Base: ${data.basePrice || 0}`);
  });
  
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
