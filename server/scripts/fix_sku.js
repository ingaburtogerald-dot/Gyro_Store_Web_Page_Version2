require('dotenv').config({ path: '../.env' });
const { db } = require('../firebase');
const config = require('../config');
const PRODUCTS = config.collections.products;

async function run() {
  const snap = await db.collection(PRODUCTS).get();
  let count = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (!data.sku && data.code) {
      await doc.ref.update({ sku: data.code });
      console.log(`Updated product ${doc.id} with sku: ${data.code}`);
      count++;
    }
  }
  console.log(`Done. Updated ${count} products.`);
}

run().catch(console.error);
