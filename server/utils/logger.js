// Logger estructurado mínimo, sin dependencias externas.
// - En producción: una línea JSON por evento (apto para los logs de Render o
//   cualquier agregador que parsee JSON).
// - En desarrollo: salida legible con icono.
// Reemplaza los console.log/error sueltos y añade niveles filtrables por
// la variable de entorno LOG_LEVEL (error | warn | info | debug).
const config = require('../config');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const activeLevel = LEVELS[process.env.LOG_LEVEL] ?? (config.isProd ? LEVELS.info : LEVELS.debug);

function emit(level, msg, meta) {
  if (LEVELS[level] > activeLevel) return;
  const time = new Date().toISOString();
  if (config.isProd) {
    process.stdout.write(JSON.stringify({ time, level, msg, ...(meta || {}) }) + '\n');
  } else {
    const icon = { error: '❌', warn: '⚠️ ', info: 'ℹ️ ', debug: '·' }[level] || '·';
    const extra = meta && Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    console.log(`${icon} ${msg}${extra}`);
  }
}

module.exports = {
  error: (msg, meta) => emit('error', msg, meta),
  warn: (msg, meta) => emit('warn', msg, meta),
  info: (msg, meta) => emit('info', msg, meta),
  debug: (msg, meta) => emit('debug', msg, meta),
};
