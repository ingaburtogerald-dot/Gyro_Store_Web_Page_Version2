// Siembra la plantilla "KZ EDX Pro X" en la colección `templates`.
// Idempotente (usa un id fijo). Ejecutar con:  node scripts/seedTemplate.js
const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { db, FieldValue } = require('../../server/firebase');
const config = require('../../server/config');

const TEMPLATE = {
  id: 'kz-edx-pro-x',
  name: 'KZ EDX Pro X',
  description: '🎧 Descubre el sonido en su máxima expresión con los KZ EDX Pro X\n\nLos audífonos in-ear KZ EDX Pro X representan la evolución en monitoreo de audio. Diseñados tanto para amantes de la música como para músicos exigentes, ofrecen bajos profundos, medios claros y agudos cristalinos, garantizando una resolución de sonido de alta fidelidad (Hi-Fi).\n\n✨ Características Destacadas:\n• Ergonomía superior: Su diseño translúcido no solo es visualmente impresionante, sino que se adapta perfectamente al contorno de la oreja para brindar comodidad durante largas sesiones y un excelente aislamiento de ruido pasivo.\n• Cable desmontable: Incluyen un cable de cobre libre de oxígeno (OFC) que evita enredos y mejora la transmisión de la señal. Además, sus pines te permiten usar módulos Bluetooth en el futuro.\n• Fáciles de usar: Gracias a su baja impedancia, suenan increíble conectados directamente a tu celular o computadora sin necesidad de amplificadores extras.\n\nYa sea para escuchar tus playlists favoritas, jugar con audio inmersivo o monitorear, los KZ EDX Pro X son la mejor inversión en calidad-precio.',
  category: 'audifonos-kz', // coincide con config.categories
  axes: [
    { key: 'conector', label: 'Conexión', options: ['Tipo C', 'Jack 3.5mm'], isColor: false },
    { key: 'microfono', label: 'Micrófono', options: ['Con micrófono', 'Sin micrófono'], isColor: false },
    { key: 'color', label: 'Color', options: ['Negro', 'Transparente', 'Turquesa', 'Gris'], isColor: true },
  ],
  specs: [
    { label: 'Impedancia', value: '24 Ω' },
    { label: 'Sensibilidad', value: '112 dB' },
    { label: 'Respuesta de frecuencia', value: '20 Hz – 40 kHz' },
    { label: 'Conector', value: 'A elección (Tipo C o Jack 3.5mm)' },
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
