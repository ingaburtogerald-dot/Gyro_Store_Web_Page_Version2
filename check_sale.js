const { db } = require('./server/firebase');

async function check() {
  const snap = await db.collection('orders').doc('A4L7grSre3b5qJo9mK6a').get();
  console.log('Exists?', snap.exists);
  if (snap.exists) {
    console.log(snap.data());
  }
}
check();
