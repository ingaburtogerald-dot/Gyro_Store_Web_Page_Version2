const path = require('path');
process.chdir(path.join(__dirname, '..'));

const { db, FieldValue } = require('../../server/firebase');
const config = require('../../server/config');

const TEMPLATE = {
  id: 'attack-shark-x11',
  name: 'Attack Shark X11',
  description: '🖱️ Mouse inalámbrico ultraligero con dock de carga magnética\n\nEl Attack Shark X11 redefine el gaming con su sensor PixArt PAW3311 de alta precisión y un peso ultraligero de tan solo 63g. Diseñado para ofrecer la máxima comodidad y rendimiento, cuenta con conexión de tres modos (Tri-mode) y una base de carga magnética con iluminación RGB para mantener siempre tu setup impecable.\n\n✨ Características Destacadas:\n• Conectividad Tri-mode: Juega sin límites gracias a su soporte para conexión Inalámbrica 2.4GHz, Bluetooth 5.2 y cable USB Tipo-C.\n• Precisión Extrema: Equipado con el sensor PixArt PAW3311, alcanza hasta 22,000 DPI para un rastreo perfecto.\n• Dock de Carga Magnética: Olvídate de los cables. Incluye una base de carga magnética RGB súper conveniente.\n• Diseño Ultraligero: Con solo 63g de peso, su diseño ambidiestro permite movimientos rápidos y reduce la fatiga tras largas horas de uso.',
  category: 'accesorios-gaming', // coincide con config.categories o el frontend
  axes: [
    { key: 'color', label: 'Color', options: ['Blanco', 'Negro', 'Rojo'], isColor: true },
  ],
  specs: [
    { label: 'Sensor', value: 'PixArt PAW3311' },
    { label: 'DPI', value: 'Hasta 22,000 DPI' },
    { label: 'Tasa de sondeo (Polling Rate)', value: '1000 Hz' },
    { label: 'Conectividad', value: '2.4Ghz Inalámbrico / Bluetooth 5.2 / Cable Tipo-C' },
    { label: 'Peso', value: '63g (±3g)' },
    { label: 'Switches', value: 'Mecánicos Huano' },
    { label: 'Batería', value: 'Aprox. 65 horas' },
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
