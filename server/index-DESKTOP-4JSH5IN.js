const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const { createRequestHandler } = require('@remix-run/express');

const config = require('./config');
const { apiLimiter } = require('./middleware/rateLimiter');
const { startCronJobs } = require('./cron/cleanup');

const app = express();

// ── MIDDLEWARES GLOBALES ──
app.use(morgan('dev'));
app.use(compression());

// Configuración de Helmet para seguridad. En producción, configuramos Content Security Policy (CSP)
// de forma adecuada si es necesario, o usamos defaults razonables.
app.use(
  helmet({
    contentSecurityPolicy: false, // Se desactiva o ajusta para Remix en producción si bloquea assets externos
  })
);

// Habilitar CORS
app.use(
  cors({
    origin: config.corsOrigin || '*',
    credentials: true,
  })
);

// Parsers de Body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── TAREAS PROGRAMADAS ──
startCronJobs();

// ── MONTAJE DE LA API ──
// Límite general de tasa para la API (/api/*)
app.use('/api', apiLimiter);

// Endpoint de Salud (Requerido por Render)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
  });
});

// Registrar todas las rutas de la API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/catalog', require('./routes/catalog'));
app.use('/api/config', require('./routes/config'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/logistics', require('./routes/logistics'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/users', require('./routes/users'));

// ── MANEJO DEL FRONTEND (REMIX) EN PRODUCCIÓN ──
if (config.nodeEnv === 'production') {
  console.log('🚀 Modo producción detectado. Sirviendo archivos estáticos y manejador de Remix.');

  const BUILD_DIR = path.join(process.cwd(), 'frontend', 'build');

  // Sirve los archivos estáticos generados por el build del cliente de Remix
  // (Normalmente en frontend/build/client)
  app.use(express.static(path.join(BUILD_DIR, 'client'), { maxAge: '1y' }));

  // Cualquier ruta que no coincida con la API se delega al request handler de Remix
  app.all('*', (req, res, next) => {
    try {
      const build = require(path.join(BUILD_DIR, 'server', 'index.js'));
      return createRequestHandler({ build, mode: 'production' })(req, res, next);
    } catch (error) {
      next(error);
    }
  });
} else {
  // En desarrollo local, informamos que Vite maneja el frontend por separado
  app.get('/', (req, res) => {
    res.send('Servidor API de Gyro Store ejecutándose en modo desarrollo. Abre el frontend de Vite en el puerto 5173.');
  });
}

// Middleware centralizado para manejo de errores
app.use((err, req, res, next) => {
  console.error('❌ Error no controlado en el servidor:', err);
  res.status(err.status || 500).json({
    error: config.nodeEnv === 'development' ? err.message : 'Ocurrió un error interno en el servidor.',
  });
});

// ── INICIALIZACIÓN ──
const PORT = config.port || 3000;
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  🎮 Servidor de Gyro Store iniciado con éxito`);
  console.log(`  🌐 Puerto: ${PORT}`);
  console.log(`  🛠️  Entorno: ${config.nodeEnv}`);
  console.log(`  📱 WhatsApp de la tienda: ${config.whatsapp}`);
  console.log(`======================================================\n`);
});
