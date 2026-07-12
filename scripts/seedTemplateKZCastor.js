const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { db, FieldValue } = require('../server/firebase');
const config = require('../server/config');

const TEMPLATE = {
  id: 'kz-castor',
  name: 'KZ Castor',
  description: '🎛️ Doble driver dinámico y sonido personalizable de otro nivel\n\nLos audífonos in-ear KZ Castor representan una verdadera revolución gracias a su innovador diseño acústico de doble driver dinámico apilado. Un driver se encarga de entregar graves potentes y profundos, mientras que el otro se especializa en ofrecer frecuencias medias y altas con una claridad cristalina.\n\n✨ Características Destacadas:\n• Versiones Harman o Bass Enhanced para adaptarse a tu estilo musical.\n• Interruptores de ajuste (Switches): Cada auricular incorpora pequeños interruptores integrados que te permiten modificar y personalizar las frecuencias bajas y altas según tus gustos musicales.\n• Diseño premium: Su carcasa ergonómica combina resina de alta calidad con un panel frontal metálico brillante, asegurando comodidad, aislamiento y un estilo inigualable.\n• Cable profesional: Cable de cobre libre de oxígeno con conectores de 2 pines (0.75mm), totalmente desmontable y resistente a enredos.',
  category: 'audifonos-kz', // coincide con config.categories
  axes: [
    { key: 'version', label: 'Versión', options: ['Harman', 'Bass Enhanced'], isColor: true },
    { key: 'conector', label: 'Conexión', options: ['Tipo C', 'Jack 3.5mm'], isColor: false },
    { key: 'microfono', label: 'Micrófono', options: ['Con micrófono', 'Sin micrófono'], isColor: false },
  ],
  specs: [
    { label: 'Controladores', value: 'Doble Driver Dinámico' },
    { label: 'Impedancia', value: '31 - 35 Ω (Harman) / 16 - 20 Ω (Bass)' },
    { label: 'Sensibilidad', value: '103 - 105 dB' },
    { label: 'Respuesta de frecuencia', value: '20 Hz – 40 kHz' },
    { label: 'Filtros acústicos', value: 'Switches integrados ajustables' },
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
