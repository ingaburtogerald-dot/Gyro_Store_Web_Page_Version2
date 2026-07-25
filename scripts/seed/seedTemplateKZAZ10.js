const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { db, FieldValue } = require('../../server/firebase');
const config = require('../../server/config');

const TEMPLATE = {
  id: 'kz-az10',
  name: 'KZ AZ10',
  description: '📶 Tu experiencia in-ear, ahora totalmente inalámbrica y sin límites\n\nEl módulo Bluetooth KZ AZ10 da un salto a la nueva generación del audio inalámbrico. Diseñado para ofrecer máxima libertad sin sacrificar la calidad de tu música, este adaptador de nivel profesional convierte tus audífonos KZ con cable en verdaderos auriculares TWS.\n\n✨ Características Destacadas:\n• Tres modos de rendimiento: Disfruta de la versatilidad de sus modos de Sonido Espacial, Modo Gaming de baja latencia y Modo Estándar para música.\n• Conexión ultrarrápida y estable: Equipado con Bluetooth 5.2, ofrece un rango de alcance impecable y un emparejamiento automático al sacarlos del estuche.\n• Estuche de gran capacidad: El estuche de carga inteligente cuenta con una batería de 800 mAh, asegurando hasta 54 horas de reproducción total (aproximadamente 6 horas de batería en los ganchos).\n• Diseño ergonómico deportivo: Su diseño sobre la oreja se ajusta de manera segura y cómoda. Ideal para entrenamientos intensos gracias a su resistencia a salpicaduras y sudor.\n\nExperimenta el audio Hi-Fi sin las ataduras de los cables y lleva tu sonido KZ al siguiente nivel.',
  category: 'adaptador-bt', // coincide con config.categories
  axes: [
    { key: 'tipo-pin', label: 'Tipo de Pin', options: ['Pin C', 'Pin B'], isColor: false },
  ],
  specs: [
    { label: 'Versión Bluetooth', value: '5.2' },
    { label: 'Alcance inalámbrico', value: 'Hasta 15 metros' },
    { label: 'Batería del módulo', value: '50 mAh (cada uno)' },
    { label: 'Batería del estuche', value: '800 mAh' },
    { label: 'Tiempo de reproducción', value: '6 horas (hasta 54 horas con estuche)' },
    { label: 'Modos especiales', value: 'Gaming / Espacial / Estándar' }
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
