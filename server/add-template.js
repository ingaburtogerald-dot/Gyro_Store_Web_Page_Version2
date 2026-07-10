const { db } = require('./firebase');

async function main() {
  const template = {
    name: 'Mouse X11',
    category: 'accesorios-pc',
    description: 'Mouse inalámbrico para juegos con base de carga',
    axes: [
      {
        key: 'color',
        label: 'Color',
        options: ['Negro', 'Rojo'],
        isColor: true
      }
    ],
    specs: [
      { label: 'Modelo', value: 'Attack Shark X11' },
      { label: 'Sensor', value: 'PixArt PAW3311' },
      { label: 'Conexión', value: 'Inalámbrico (2.4GHz / Bluetooth) y Cableado' }
    ]
  };

  try {
    const docRef = await db.collection('templates').add(template);
    console.log('✅ Plantilla agregada exitosamente con ID:', docRef.id);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error al agregar plantilla:', err);
    process.exit(1);
  }
}

main();
