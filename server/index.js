const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const config = require('./config');
const logger = require('./utils/logger');

require('./firebase'); // inicializa Firebase Admin

const { apiLimiter } = require('./middleware/rateLimiter');
const { sanitizeBody } = require('./utils/sanitize');

const app = express();

// Render (y cualquier PaaS) sirve detrás de un proxy. Sin esto, express-rate-limit
// ve la IP del proxy en vez de la del cliente: el límite se compartiría entre todos
// los usuarios y los logs registrarían la IP equivocada. '1' = confiar en un solo salto.
app.set('trust proxy', 1);

// ── Seguridad y middleware base ──
// COOP relajado a 'same-origin-allow-popups': el COOP por defecto de helmet
// ('same-origin') aísla la ventana y rompe signInWithPopup de Firebase (el popup
// de Google no puede comunicarse de vuelta → auth/popup-closed-by-user).
app.use(helmet({
  contentSecurityPolicy: false, // CSP se afina al desplegar el front
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}));
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeBody);

// CORS: en producción, restringido al dominio configurado; en dev, abierto.
const corsOptions = config.isProd && config.corsOrigin
  ? { origin: config.corsOrigin.split(',').map((s) => s.trim()), credentials: true }
  : {};
app.use(cors(corsOptions));

// Logging de requests: legible en dev; en producción se emite vía el logger
// estructurado (una línea JSON por request) para que quede en los logs de Render.
if (config.isProd) {
  app.use('/api', morgan('combined', { stream: { write: (line) => logger.info('http_request', { line: line.trim() }) } }));
} else {
  app.use('/api', morgan('dev'));
}

// ── API REST ──
app.use('/api', apiLimiter);
app.get('/api/health', (req, res) => res.json({ ok: true, env: config.env }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/config', require('./routes/config'));
app.use('/api/catalog', require('./routes/catalog'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/combos', require('./routes/combos'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/logistics', require('./routes/logistics'));
app.use('/api/installments', require('./routes/installments'));
app.use('/api/followups', require('./routes/followups'));
app.use('/api/contacts', require('./routes/contacts'));

// 404 para endpoints de API no encontrados
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint no encontrado.' }));

// ── Manejador central de errores ──
app.use((err, req, res, next) => {
  logger.error('unhandled_error', { method: req.method, path: req.originalUrl, message: err.message, stack: err.stack });
  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Datos inválidos.', issues: err.errors });
  }
  // Errores de subida (multer): tamaño excedido o tipo de archivo rechazado.
  if (err.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? 'El archivo supera el tamaño máximo permitido.'
      : 'No se pudo procesar el archivo enviado.';
    return res.status(400).json({ error: msg });
  }
  // Errores con status explícito (p. ej. fileFilter → 400): se respeta el código
  // y el mensaje. Cualquier otro caso es un 500 con mensaje genérico (no filtrar detalles).
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(status).json({ error: status === 500 ? 'Error interno del servidor.' : err.message });
});

const { startCronJobs } = require('./cron/cleanup');

// ── Arranque: carga el build ESM de Remix con import() dinámico ──
const clientBuild = path.join(__dirname, '..', 'frontend', 'build', 'client');
const serverBuildPath = path.join(__dirname, '..', 'frontend', 'build', 'server', 'index.js');

async function start() {
  if (config.isProd && fs.existsSync(clientBuild) && fs.existsSync(serverBuildPath)) {
    const { createRequestHandler } = await import('@remix-run/express');
    const build = await import(pathToFileURL(serverBuildPath).href);

    // Assets estáticos del cliente (JS/CSS con hash → cache inmutable)
    app.use(
      express.static(clientBuild, {
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }),
    );

    // Remix SSR maneja todas las rutas no-API
    app.all('*', createRequestHandler({ build }));
  } else {
    app.get('/', (req, res) =>
      res.send('🚀 Gyro Store API en línea. Construye el frontend con: cd frontend && npm run build'),
    );
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`\n🚀 Gyro Store [${config.env}]`);
    console.log(`   API:      http://localhost:${config.port}/api/health`);
    console.log(`   Catálogo: http://localhost:${config.port}/\n`);
    startCronJobs();
  });
}

start().catch((err) => {
  console.error('❌ Error arrancando el servidor:', err);
  process.exit(1);
});
