// Siembra la plantilla "KZ EDX Pro X" en la colección `templates`.
// Idempotente (usa un id fijo). Ejecutar con:  node scripts/seedTemplate.js
const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { db, FieldValue } = require('../server/firebase');
const config = require('../server/config');

const TEMPLATE = {
  id: 'kz-edx-pro-x',
  name: 'KZ EDX Pro X',
  category: 'audifonos-kz', // coincide con config.categories
  axes: [
    { key: 'conector', label: 'Conexión', options: ['Tipo C', 'Jack 3.5mm'], isColor: false },
    { key: 'microfono', label: 'Micrófono', options: ['Con micrófono', 'Sin micrófono'], isColor: false },
    { key: 'color', label: 'Color', options: ['Negro', 'Transparente', 'Turquesa', 'Gris'], isColor: true },
  ],
  specs: [
    { label: 'Driver', value: '10mm dinámico de doble imán' },
    { label: 'Impedancia', value: '24 Ω' },
    { label: 'Sensibilidad', value: '112 dB' },
    { label: 'Respuesta de frecuencia', value: '20 Hz – 40 kHz' },
    { label: 'Conector', value: 'Intercambiable (Tipo C / Jack 3.5mm)' },
  ],
};

async function run() {
  const { id, ...data } = TEMPLATE;
  await db
    .collection(config.collections.templates)
    .doc(id)
    .set({ ...data, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  console.log(`\n✅ Plantilla lista: ${data.name} (id: ${id})`);
  console.log(`   Categoría: ${data.category}`);
  console.log(`   Ejes: ${data.axes.map((a) => a.label).join(', ')}\n`);
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Error al sembrar la plantilla:', err.message);
  process.exit(1);
});
