const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { db, FieldValue } = require('../../server/firebase');
const config = require('../../server/config');

const TEMPLATE = {
  id: 'kz-az09',
  name: 'KZ AZ09',
  description: '📶 Convierte tus audífonos KZ en una experiencia 100% inalámbrica\n\nEl módulo Bluetooth KZ AZ09 transforma tus audífonos KZ con cable en verdaderos auriculares inalámbricos. Diseñado para ofrecer máxima libertad sin sacrificar la calidad del sonido, este adaptador es el complemento perfecto para tus audífonos favoritos.\n\n✨ Características Destacadas:\n• Conexión ultrarrápida: Equipado con Bluetooth 5.2, ofrece una conexión más estable, mayor rango de alcance y menor consumo de energía.\n• Baja latencia: Ideal para disfrutar de tus videojuegos y videos favoritos sin molestos retrasos entre la imagen y el audio.\n• Estuche de gran capacidad: El estuche de carga incluido cuenta con una batería de 800 mAh, asegurando múltiples recargas para horas de reproducción continua.\n• Ganchos ergonómicos: Su diseño sobre la oreja se ajusta de manera segura y cómoda, ideal para hacer deporte o moverte sin preocupaciones.\n\nLibérate de los cables y lleva la alta fidelidad de KZ a todas partes con el adaptador AZ09.',
  category: 'adaptador-bt', // coincide con config.categories
  axes: [
    { key: 'tipo-pin', label: 'Tipo de Pin', options: ['Pin C', 'Pin B'], isColor: false },
  ],
  specs: [
    { label: 'Versión Bluetooth', value: '5.2' },
    { label: 'Alcance inalámbrico', value: 'Hasta 15 metros' },
    { label: 'Batería del módulo', value: '50 mAh (cada uno)' },
    { label: 'Batería del estuche', value: '800 mAh' },
    { label: 'Tiempo de reproducción', value: 'Aprox. 6 horas por carga' },
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
