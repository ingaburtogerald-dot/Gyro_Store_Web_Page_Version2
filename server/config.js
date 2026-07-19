// Configuración central del backend. Lee variables de entorno desde .env.
// Fuente única de constantes de negocio expuestas al frontend vía GET /api/config.
require('dotenv').config();

function parseEmailList(value) {
  return (value || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

const adminEmails = parseEmailList(process.env.ADMIN_EMAILS || 'ingaburtogerald@gmail.com');
const sellerEmails = parseEmailList(process.env.SELLER_EMAILS);

module.exports = {
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 3000,
  // URL pública de la app. Los botones de los correos salen de aquí, así que
  // en producción NUNCA debe caer a localhost: si faltan las variables de
  // entorno, se usa el dominio real como respaldo.
  appUrl:
    process.env.RENDER_EXTERNAL_URL ||
    process.env.APP_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'https://gyro-store.onrender.com'
      : `http://localhost:${Number(process.env.PORT) || 3000}`),

  // Credenciales de Firebase Admin
  serviceAccountPath: process.env.SERVICE_ACCOUNT_PATH || 'serviceAccountKey.json',

  // Roles válidos del sistema. global_admin tiene acceso total a todos los portales.
  // El orden define la prioridad para elegir el "rol primario" de un usuario multi-rol.
  validRoles: ['global_admin', 'admin', 'seller', 'cashier', 'logistics_admin', 'logistics_customer'],
  rolePriority: ['global_admin', 'admin', 'seller', 'cashier', 'logistics_admin', 'logistics_customer'],

  // Whitelist de roles por correo (arranque sin depender de Firestore)
  adminEmails,
  sellerEmails,
  // El primer admin queda protegido: no puede ser editado ni eliminado por nadie
  protectedEmail: (process.env.PROTECTED_ADMIN_EMAIL || adminEmails[0] || 'ingaburtogerald@gmail.com').toLowerCase(),

  // Dominio interno: los correos @gyrostore.com se consideran usuarios locales verificados
  internalDomain: process.env.INTERNAL_DOMAIN || 'gyrostore.com',

  // Config pública de la Web App de Firebase (para login en el navegador)
  firebaseWeb: (() => {
    let web = {
      apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyBLY5gl79jcWKtWfRzXqeuuNnySfBkHW-w',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'gyro-store.firebaseapp.com',
      projectId: process.env.FIREBASE_PROJECT_ID || 'gyro-store',
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '581518711166',
      appId: process.env.FIREBASE_APP_ID || '1:581518711166:web:8bc771155186c8c222fb2f',
      measurementId: 'G-KW3ZG01D8R'
    };
    if (process.env.FIREBASE_WEB_CONFIG) {
      try {
        web = { ...web, ...JSON.parse(process.env.FIREBASE_WEB_CONFIG) };
      } catch (err) {
        console.error('⚠️  Error al parsear FIREBASE_WEB_CONFIG:', err.message);
      }
    }
    return web;
  })(),

  // ── Datos de negocio (se exponen vía GET /api/config) ──
  whatsapp: process.env.WHATSAPP_NUMBER || '50585944758',
  currency: process.env.CURRENCY || 'C$',
  // Tipo de cambio fijo USD → Córdobas
  exchangeRate: Number(process.env.EXCHANGE_RATE) || 37,

  // Costos fijos por defecto (porcentajes configurables desde el admin → app_config)
  costosFijos: { publicidad: 10, servicios: 5, utiles: 5, garantias: 5 },

  // Grupos de gasto para el registro de gastos operativos.
  // Los presupuestados (budgeted:true) tienen "pozo" = reserva de costos fijos del mes
  // repartida por su % en `costosFijos`. Mientras el gasto no supere su pozo NO afecta la
  // ganancia (ya estaba reservado); solo el excedente la reduce.
  // 'varios' NO tiene pozo: todo lo registrado ahí baja la ganancia directamente
  // (préstamos, uso personal del dueño desde caja chica, etc.).
  expenseGroups: [
    { key: 'publicidad', label: 'Publicidad', budgeted: true },
    { key: 'servicios', label: 'Servicios Básicos', budgeted: true },
    { key: 'utiles', label: 'Útiles', budgeted: true },
    { key: 'garantias', label: 'Garantías', budgeted: true },
    { key: 'varios', label: 'Gastos Varios', budgeted: false },
  ],

  // Colecciones de Firestore (fuente única de nombres)
  collections: {
    catalog: 'catalog',
    templates: 'templates',
    combos: 'combos',
    products: 'products',
    purchases: 'purchases',
    migratedInventory: 'migrated_inventory',
    orders: 'orders',
    publicOrders: 'public_orders',
    invoices: 'invoices',
    users: 'users',
    usersDeleted: 'users_deleted',
    logisticsShipments: 'logistics_shipments',
    appConfig: 'app_config',
    losses: 'losses',
    installments: 'installments',
    stockReservations: 'stock_reservations',
    auditLogs: 'audit_logs',
    followups: 'followups',
    contacts: 'contacts',
    payments: 'payments',
    commissionAdjustments: 'commission_adjustments',
    counters: 'counters',
    analyticsEvents: 'analytics_events',
    feedback: 'feedback',
    discountCodes: 'discount_codes',
  },

  // CORS: orígenes permitidos en producción
  corsOrigin: process.env.RENDER_EXTERNAL_URL || process.env.CORS_ORIGIN || '',

  // Configuración SMTP para correos
  email: (() => {
    let mail = {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: Number(process.env.EMAIL_PORT) || 465,
      secure: process.env.EMAIL_SECURE !== 'false',
      user: process.env.EMAIL_USER || 'storegyro01@gmail.com',
      pass: process.env.EMAIL_PASS || '',
      from: process.env.EMAIL_FROM || '"Gyro Store" <storegyro01@gmail.com>',
    };
    if (process.env.EMAIL_CONFIG) {
      try {
        mail = { ...mail, ...JSON.parse(process.env.EMAIL_CONFIG) };
      } catch (err) {
        console.error('⚠️  Error al parsear EMAIL_CONFIG:', err.message);
      }
    }
    return mail;
  })(),
};
