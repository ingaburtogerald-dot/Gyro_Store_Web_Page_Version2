const { db } = require('../../server/firebase');

async function main() {
  const docId = 'ZzzdnQy3NLzGuCyr3fL9'; // ID of the Mouse X11 template

  const updatedData = {
    description: `**Domina cada partida con precisión absoluta y sin cables.**\n\nEl **Attack Shark X11** no es solo un mouse, es tu nueva ventaja competitiva. Diseñado para los jugadores más exigentes, combina un peso ultraligero con tecnología de seguimiento de nivel profesional para que tus movimientos sean más rápidos y precisos que nunca.\n\n**Características principales:**\n• **Precisión de Élite:** Equipado con el sensor óptico PixArt PAW3311, ofrece un seguimiento impecable y hasta 22,000 DPI.\n• **Base de Carga Magnética RGB:** Olvídate de conectar cables. Su estación de carga magnética ilumina tu setup.\n• **Conectividad Tri-Modo:** Juega sin límites mediante su receptor de 2.4GHz (cero latencia), Bluetooth o cable USB-C.\n• **Ultraligero y Ergonómico:** Peso de apenas 63 gramos.\n• **Durabilidad Extrema:** Interruptores Huano (20 millones de clics) y encoder TTC.`,
    axes: [
      {
        key: 'color',
        label: 'Color',
        options: ['Negro', 'Rojo', 'Blanco'], // Added Blanco
        isColor: true
      }
    ]
  };

  try {
    await db.collection('templates').doc(docId).update(updatedData);
    console.log('✅ Plantilla actualizada exitosamente.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error al actualizar plantilla:', err);
    process.exit(1);
  }
}

main();
