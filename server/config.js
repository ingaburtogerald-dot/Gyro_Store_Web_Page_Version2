// Configuración central del backend. Lee variables de entorno desde .env.
// Fuente única de constantes de negocio expuestas al frontend vía GET /api/config.
require('dotenv').config();

function parseEmailList(value) {
  return (value || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

const adminEmails = parseEmailList(process.env.ADMIN_EMAILS);
const sellerEmails = parseEmailList(process.env.SELLER_EMAILS);

module.exports = {
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 3000,
  appUrl: process.env.APP_URL || `http://localhost:${Number(process.env.PORT) || 3000}`,

  // Credenciales de Firebase Admin
  serviceAccountPath: process.env.SERVICE_ACCOUNT_PATH || './server/serviceAccountKey.json',

  // Roles válidos del sistema. global_admin tiene acceso total a todos los portales.
  // El orden define la prioridad para elegir el "rol primario" de un usuario multi-rol.
  validRoles: ['global_admin', 'admin', 'seller', 'cashier', 'logistics_admin', 'logistics_customer'],
  rolePriority: ['global_admin', 'admin', 'seller', 'cashier', 'logistics_admin', 'logistics_customer'],

  // Whitelist de roles por correo (arranque sin depender de Firestore)
  adminEmails,
  sellerEmails,
  // El primer admin queda protegido: no puede ser editado ni eliminado por nadie
  protectedEmail: (process.env.PROTECTED_ADMIN_EMAIL || adminEmails[0] || '').toLowerCase(),

  // Dominio interno: los correos @gyrostore.com se consideran usuarios locales verificados
  internalDomain: process.env.INTERNAL_DOMAIN || 'gyrostore.com',

  // Config pública de la Web App de Firebase (para login en el navegador)
  firebaseWeb: (() => {
    let web = {
      apiKey: process.env.FIREBASE_API_KEY || '',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.FIREBASE_APP_ID || '',
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

  // Categorías del catálogo con su ícono emoji (reciclado del proyecto anterior).
  categories: [
    { id: 'audifonos-kz', name: 'Audífonos KZ in-ear', icon: '🎧' },
    { id: 'adaptador-bt', name: 'Adaptador Bluetooth in-ear', icon: '📶' },
    { id: 'accesorios-kz', name: 'Accesorios para audífonos KZ', icon: '🎚️' },
    { id: 'accesorios-pc', name: 'Accesorios para computadora', icon: '🖱️' },
  ],

  // Costos fijos por defecto (porcentajes configurables desde el admin → app_config)
  costosFijos: { publicidad: 10, servicios: 5, utiles: 5, garantias: 5 },

  // Colecciones de Firestore (fuente única de nombres)
  collections: {
    catalog: 'catalog',
    templates: 'templates',
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
    payments: 'payments',
    commissionAdjustments: 'commission_adjustments',
  },

  // CORS: orígenes permitidos en producción
  corsOrigin: process.env.CORS_ORIGIN || '',

  // Configuración SMTP para correos
  email: (() => {
    let mail = {
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: Number(process.env.EMAIL_PORT) || 465,
      secure: process.env.EMAIL_SECURE !== 'false',
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASS || '',
      from: process.env.EMAIL_FROM || '',
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
