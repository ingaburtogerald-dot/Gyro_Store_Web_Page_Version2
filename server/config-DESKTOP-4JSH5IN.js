require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  whatsapp: process.env.WHATSAPP_NUMBER || '50585944758',
  currency: process.env.CURRENCY || 'C$',
  exchangeRate: Number(process.env.EXCHANGE_RATE) || 37,
  internalDomain: process.env.INTERNAL_DOMAIN || 'gyrostore.com',
  protectedEmail: (process.env.PROTECTED_ADMIN_EMAIL || '').toLowerCase(),
  
  // Lista de correos con permisos especiales cargados de variables de entorno
  adminEmails: (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map(e => e.trim()).filter(Boolean),
  sellerEmails: (process.env.SELLER_EMAILS || '').toLowerCase().split(',').map(e => e.trim()).filter(Boolean),

  // Configuración de roles y prioridades
  validRoles: ['global_admin', 'admin', 'seller', 'cashier', 'logistics_admin', 'logistics_customer'],
  rolePriority: ['global_admin', 'admin', 'seller', 'cashier', 'logistics_admin', 'logistics_customer'],

  // Configuración pública de Firebase Web (cliente)
  firebaseWeb: process.env.FIREBASE_WEB_CONFIG 
    ? JSON.parse(process.env.FIREBASE_WEB_CONFIG)
    : {},

  // Configuración de credenciales de Firebase Admin SDK
  firebaseAdmin: {
    serviceAccountPath: process.env.SERVICE_ACCOUNT_PATH || './serviceAccountKey.json',
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '',
  },

  // Configuración de servidor de email SMTP (Gmail App Password)
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 465,
    secure: process.env.EMAIL_SECURE === 'true' || process.env.EMAIL_SECURE === undefined || process.env.EMAIL_SECURE === true,
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
    from: process.env.EMAIL_FROM || '"Gyro Store" <no-reply@gyrostore.com>',
  },

  // Nombres de colecciones de Firestore
  collections: {
    purchases: 'purchases',
    products: 'products',
    migratedInventory: 'migrated_inventory',
    invoices: 'invoices',
    appConfig: 'app_config',
    users: 'users',
    usersDeleted: 'users_deleted',
    orders: 'orders',
    payments: 'payments',
    auditLogs: 'audit_logs',
    losses: 'losses',
    catalog: 'catalog',
    publicOrders: 'public_orders',
    logisticsShipments: 'logistics_shipments',
    templates: 'templates',
  },

  // Categorías de la tienda por defecto
  categories: [
    { id: 'audio', name: 'Audio (KZ/CCA)', icon: '🎧' },
    { id: 'bluetooth', name: 'Bluetooth & DACs', icon: '📶' },
    { id: 'accesorios', name: 'Accesorios PC/Cables', icon: '🔌' },
    { id: 'estuches', name: 'Estuches & Repuestos', icon: '💼' }
  ],
};
