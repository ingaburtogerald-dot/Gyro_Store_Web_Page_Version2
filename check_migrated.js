const { db } = require('./server/firebase');
const config = require('./server/config');

async function main() {
  console.log('=== MIGRATED INVENTORY CALCULATIONS ===');
  const snap = await db.collection(config.collections.migratedInventory).get();
  
  let totalShipping = 0;
  let totalPreTotal = 0;

  snap.docs.forEach((doc) => {
    const data = doc.data();
    const qty = data.quantity || 0;
    const shipping = data.shippingUnitUsd || data.shippingUnit || 0;
    const priceBase = data.priceBaseUsd || data.costUnit || 0;

    const rowShipping = qty * shipping;
    const rowPreTotal = qty * priceBase;

    totalShipping += rowShipping;
    totalPreTotal += rowPreTotal;

    console.log(`Code: ${data.code} | Qty: ${qty} | ShippingUnit: ${shipping} | Base: ${priceBase} | RowShip: ${rowShipping} | RowPreTotal: ${rowPreTotal}`);
  });

  console.log('-----------------------------------');
  console.log(`TOTAL SHIPPING: $${totalShipping.toFixed(2)}`);
  console.log(`TOTAL PRE-TOTAL: $${totalPreTotal.toFixed(2)}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
