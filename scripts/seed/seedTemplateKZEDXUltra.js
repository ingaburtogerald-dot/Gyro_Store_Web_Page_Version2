const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { db, FieldValue } = require('../../server/firebase');
const config = require('../../server/config');

const TEMPLATE = {
  id: 'kz-edx-ultra',
  name: 'KZ EDX Ultra',
  description: '🎵 La evolución de un clásico con rendimiento superior\n\nLos KZ EDX Ultra son la versión mejorada de la famosa serie EDX, optimizados con un nuevo controlador dinámico dual-magnético de 10 mm. Este rediseño mejora significativamente la respuesta de frecuencia, brindando bajos más profundos, medios claros y agudos suaves.\n\n✨ Características Destacadas:\n• Diseño ergonómico superior: Su carcasa de resina ha sido moldeada para ajustarse perfectamente al oído, combinando estética moderna con comodidad extrema y aislamiento pasivo de ruido.\n• Cable premium: Incluye un cable de cobre de alta pureza chapado en plata (con conectores de 2 pines de 0.75 mm), diseñado para minimizar la pérdida de señal y evitar enredos.\n• Sonido todoterreno: Ideales tanto para escuchar música casual como para sesiones largas de gaming, gracias a su excelente separación de instrumentos y claridad vocal.',
  category: 'audifonos-kz',
  axes: [
    { key: 'conector', label: 'Conexión', options: ['Tipo C', 'Jack 3.5mm'], isColor: false },
    { key: 'microfono', label: 'Micrófono', options: ['Con micrófono', 'Sin micrófono'], isColor: false },
  ],
  specs: [
    { label: 'Controlador', value: 'Dinámico Magnético Dual (10mm)' },
    { label: 'Impedancia', value: '26 Ω' },
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
