console.log('DEBUG: 1. Starting index.js...');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const config = require('./config');

console.log('DEBUG: 2. Requiring firebase...');
require('./firebase'); // inicializa Firebase Admin

console.log('DEBUG: 3. Requiring other modules...');
const { apiLimiter } = require('./middleware/rateLimiter');
const { sanitizeBody } = require('./utils/sanitize');

const app = express();

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

if (!config.isProd) app.use('/api', morgan('dev'));

// ── API REST ──
app.use('/api', apiLimiter);
app.get('/api/health', (req, res) => res.json({ ok: true, env: config.env }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/config', require('./routes/config'));
app.use('/api/catalog', require('./routes/catalog'));
app.use('/api/templates', require('./routes/templates'));
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

// 404 para endpoints de API no encontrados
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint no encontrado.' }));

// ── Manejador central de errores ──
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Datos inválidos.', issues: err.errors });
  }
  res.status(500).json({ error: 'Error interno del servidor.' });
});

const { startCronJobs } = require('./cron/cleanup');

// ── Arranque: carga el build ESM de Remix con import() dinámico ──
const clientBuild = path.join(__dirname, '..', 'frontend', 'build', 'client');
const serverBuildPath = path.join(__dirname, '..', 'frontend', 'build', 'server', 'index.js');

async function start() {
  console.log('DEBUG: 4. Inside start() function');
  if (config.isProd && fs.existsSync(clientBuild) && fs.existsSync(serverBuildPath)) {
    console.log('DEBUG: 5. Loading Remix production build...');
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
    console.log('DEBUG: 6. Using development fallback route...');
    app.get('/', (req, res) =>
      res.send('🚀 Gyro Store API en línea. Construye el frontend con: cd frontend && npm run build'),
    );
  }

  console.log('DEBUG: 7. Calling app.listen on port:', config.port);
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`\n🚀 Gyro Store [${config.env}]`);
    console.log(`   API:      http://localhost:${config.port}/api/health`);
    console.log(`   Catálogo: http://localhost:${config.port}/\n`);
    startCronJobs();
  });
}

console.log('DEBUG: 8. Invoking start()...');
start().catch((err) => {
  console.error('❌ Error arrancando el servidor:', err);
  process.exit(1);
});
