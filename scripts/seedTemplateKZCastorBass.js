const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { db, FieldValue } = require('../server/firebase');
const config = require('../server/config');

const TEMPLATE = {
  id: 'kz-castor-bass',
  name: 'KZ Castor Bass (Mejorado)',
  description: '🎛️ Doble driver dinámico con graves mejorados (Bass Enhanced)\n\nLa versión KZ Castor Bass Enhanced lleva el aclamado diseño acústico de doble driver dinámico al siguiente nivel para los verdaderos "bassheads". Un driver está calibrado específicamente para empujar las frecuencias subgraves con una potencia arrolladora, mientras el segundo driver mantiene intacta la claridad de los medios y altos.\n\n✨ Características Destacadas:\n• Interruptores de ajuste (Switches): Cuatro interruptores de sintonización que te permiten elevar los bajos y agudos de forma independiente para un sonido totalmente a medida.\n• Diseño premium: Carcasa ergonómica que combina resina médica de alta calidad con un llamativo panel frontal metálico brillante.\n• Cable profesional: Cable de cobre libre de oxígeno con conectores de 2 pines (0.75mm), altamente resistente a enredos.\n\nSiente el impacto de cada golpe y la profundidad de la música con la versión Bass del KZ Castor, diseñada para quienes no se conforman con un sonido plano.',
  category: 'audifonos-kz',
  axes: [
    { key: 'conector', label: 'Conexión', options: ['Tipo C', 'Jack 3.5mm'], isColor: false },
    { key: 'microfono', label: 'Micrófono', options: ['Con micrófono', 'Sin micrófono'], isColor: false },
  ],
  specs: [
    { label: 'Controladores', value: 'Doble Driver Dinámico (Optimizado para Graves)' },
    { label: 'Impedancia', value: '16 - 20 Ω' },
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
