const { db } = require('./server/firebase');

async function checkAZ09() {
  const snap = await db.collection('catalog').where('name', '==', 'KZ AZ09').get();
  if (snap.empty) {
    const all = await db.collection('catalog').get();
    console.log("No AZ09 found exactly. Here are some names:");
    all.docs.forEach(d => {
      if (d.data().name.includes("AZ09")) {
        console.log("- " + d.data().name + " (ID: " + d.id + ")");
        console.log(JSON.stringify(d.data(), null, 2));
      }
    });
  } else {
    snap.docs.forEach(d => {
      console.log("Found: " + d.data().name + " (ID: " + d.id + ")");
      console.log(JSON.stringify(d.data(), null, 2));
    });
  }
}

checkAZ09().catch(console.error);
