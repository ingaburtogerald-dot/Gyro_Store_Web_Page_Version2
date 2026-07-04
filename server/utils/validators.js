// Esquemas Zod del servidor. Donde sea posible, comparten forma con los
// validadores del frontend (frontend/app/lib/validators.ts).
const { z } = require('zod');
const config = require('../config');

const roleEnum = z.enum(config.validRoles);

// Crear / invitar usuario desde el portal de gestión.
const createUserSchema = z.object({
  email: z.string().email('Correo inválido'),
  displayName: z.string().min(2, 'Nombre muy corto').max(80),
  roles: z.array(roleEnum).min(1, 'Asigna al menos un rol'),
  provider: z.enum(['local', 'google', 'microsoft']).default('local'),
});

// Formulario de contacto público.
const contactSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().min(7).max(20).optional().or(z.literal('')),
  message: z.string().min(5).max(2000),
});

// Registro de una compra en China (un producto por registro; comparte lote).
const purchaseSchema = z.object({
  purchaseDate: z.string().min(1, 'Fecha requerida'),
  lot: z.string().min(1, 'Lote requerido').max(40),
  code: z.string().min(1, 'Código requerido').max(40),
  productName: z.string().min(2, 'Nombre requerido').max(120),
  quantity: z.coerce.number().int().positive(),
  costUnit: z.coerce.number().nonnegative(),
  taxUnit: z.coerce.number().nonnegative(),
  suggestedPrice: z.coerce.number().nonnegative().optional(), // precio sugerido manual (C$)
});

// Inventario MIGRADO: ítem histórico cargado a mano desde el Excel viejo.
// Reglas propias (más laxas) y aislado de las compras nativas; lleva origin:'migrated'.
const migratedItemSchema = z.object({
  purchaseDate: z.string().min(1, 'Fecha requerida'),
  lot: z.string().max(40).optional().default(''),
  code: z.string().min(1, 'Código requerido').max(40),
  productName: z.string().min(2, 'Nombre requerido').max(120),
  quantity: z.coerce.number().int().positive(),        // compradas
  costUnit: z.coerce.number().nonnegative(),           // precio base USD
  shippingUnit: z.coerce.number().nonnegative(),       // costo de envío unitario USD
  comments: z.string().max(500).optional().default(''),
});

// Reportar llegada a Nicaragua.
const arrivalSchema = z.object({
  arrivalDate: z.string().min(1, 'Fecha de ingreso requerida'),
  shippingUnit: z.coerce.number().nonnegative(),
  category: z.string().min(1, 'Categoría requerida'),
  suggestedPrice: z.coerce.number().nonnegative().optional(),
});

// Venta en cuotas (solo admin puede crear).
const installmentSchema = z.object({
  customerName: z.string().min(2, 'Nombre del cliente requerido').max(80),
  customerPhone: z.string().min(7).max(20).optional().or(z.literal('')),
  sellerEmail: z.string().email().optional().or(z.literal('')),
  sellerName: z.string().max(80).optional().or(z.literal('')),
  sellerUid: z.string().optional().or(z.literal('')),
  items: z.array(z.object({
    productId: z.string().min(1),
    name: z.string().min(1),
    quantity: z.coerce.number().int().positive(),
    salePrice: z.coerce.number().nonnegative(),
  })).min(1, 'La venta debe tener al menos un producto'),
  totalAmount: z.coerce.number().positive('El monto total debe ser positivo'),
  numInstallments: z.coerce.number().int().min(2).max(24),
  installmentAmount: z.coerce.number().positive(),
  firstPaymentDate: z.string().min(1, 'Fecha del primer pago requerida'),
  notes: z.string().max(500).optional().default(''),
});

// Registrar un pago de cuota (admin).
const installmentPaymentSchema = z.object({
  amount: z.coerce.number().positive('El monto del pago es requerido'),
  paymentDate: z.string().min(1, 'Fecha del pago requerida'),
  nextPaymentDate: z.string().optional().or(z.literal('')),
  paymentMethod: z.enum(['efectivo', 'transferencia', 'tarjeta']).optional(),
  notes: z.string().max(300).optional().default(''),
});

// Seguimiento de cliente (CRM): apuntar follow-ups con fecha.
const followupSchema = z.object({
  customerName: z.string().min(2, 'Nombre del cliente requerido').max(80),
  customerPhone: z.string().max(20).optional().default(''),
  type: z.enum(['callback', 'restock', 'other']).optional().default('callback'),
  product: z.string().max(120).optional().default(''),
  note: z.string().max(1000).optional().default(''),
  followUpDate: z.string().min(1, 'Fecha de seguimiento requerida'),
  status: z.enum(['pending', 'done', 'lost']).optional().default('pending'),
});

// ── CRM v2: Contactos (leads) + Actividades (historial) ──
// Un "contacto" es la persona/lead; su historial vive en la subcolección
// `contacts/{id}/activities`. La etapa del embudo (`stage`) es distinta del
// estado de una tarea individual (`done` en la actividad): ejes ortogonales.
const CRM_STAGES = ['new', 'contacted', 'negotiating', 'won', 'lost'];
const ACTIVITY_TYPES = ['call', 'whatsapp', 'note', 'restock', 'meeting'];

// Crear / editar un contacto del CRM.
const crmContactSchema = z.object({
  name: z.string().min(2, 'Nombre del cliente requerido').max(80),
  phone: z.string().max(20).optional().default(''),
  email: z.string().email('Correo inválido').optional().or(z.literal('')),
  product: z.string().max(120).optional().default(''),
  source: z.string().max(60).optional().default(''),
  value: z.coerce.number().nonnegative().optional().default(0),
  tags: z.array(z.string().max(30)).max(12).optional().default([]),
  stage: z.enum(CRM_STAGES).optional().default('new'),
});

// Registrar una interacción en el historial de un contacto.
// `dueAt`: ISO datetime con hora si es una tarea programada; null/ausente = registro ya hecho.
const crmActivitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES),
  body: z.string().max(2000).optional().default(''),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
  outcome: z.enum(['positive', 'neutral', 'negative']).nullable().optional(),
});

module.exports = {
  roleEnum,
  createUserSchema,
  contactSchema,
  purchaseSchema,
  migratedItemSchema,
  arrivalSchema,
  installmentSchema,
  installmentPaymentSchema,
  followupSchema,
  crmContactSchema,
  crmActivitySchema,
  CRM_STAGES,
  ACTIVITY_TYPES,
};
