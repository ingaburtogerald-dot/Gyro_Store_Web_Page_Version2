// Esquemas Zod del servidor. Donde sea posible, comparten forma con los
// validadores del frontend (frontend/app/schemas/validators.ts).
const { z } = require('zod');
const config = require('../config');
const {
  contactSchema,
  feedbackSchema,
  purchaseSchema,
  migratedItemSchema,
  arrivalSchema,
  installmentSchema,
  installmentPaymentSchema,
} = require('../../shared/schemas.mjs');

const roleEnum = z.enum(config.validRoles);

// Crear / invitar usuario desde el portal de gestión.
const createUserSchema = z.object({
  email: z.string().email('Correo inválido'),
  displayName: z.string().min(2, 'Nombre muy corto').max(80),
  roles: z.array(roleEnum).min(1, 'Asigna al menos un rol'),
  provider: z.enum(['local', 'google', 'microsoft']).default('local'),
});

// Ítem de una venta registrada (vendedor/admin). El precio y los totales SIEMPRE
// se recalculan en el servidor desde Firestore (ver buildLines); este schema solo
// valida la FORMA de lo que manda el cliente antes de tocar la BD.
const saleItemSchema = z.object({
  productId: z.string().min(1, 'Producto inválido'),
  origin: z.enum(['native', 'migrated']).optional().default('native'),
  quantity: z.coerce.number().int().positive(),
  salePrice: z.coerce.number().nonnegative(),
  variantName: z.string().max(120).optional().default('Estándar'),
  mode: z.enum(['M1', 'M2']).optional(),
});
const saleItemsSchema = z.array(saleItemSchema).min(1, 'La venta no tiene productos.');

// Código de descuento (admin crea, ej. incentivo por reseña en Google/Facebook).
// `code` se normaliza a mayúsculas SIN espacios en la ruta (no acá) y se usa como
// id del doc en Firestore → unicidad gratis, sin query extra.
const discountCodeSchema = z.object({
  code: z.string().trim().min(3, 'Mínimo 3 caracteres').max(30, 'Máximo 30 caracteres')
    .regex(/^[a-zA-Z0-9-]+$/, 'Solo letras, números y guiones'),
  type: z.enum(['percent', 'fixed']),
  value: z.coerce.number().positive('Debe ser mayor a 0'),
  maxUses: z.coerce.number().int().nonnegative().optional().default(1), // 0 = ilimitado
  expiresAt: z.string().optional().or(z.literal('')), // fecha ISO (yyyy-mm-dd) o vacío = sin vencimiento
  note: z.string().max(200).optional().default(''),
}).refine((d) => d.type !== 'percent' || d.value <= 100, {
  message: 'Un descuento por porcentaje no puede superar 100%',
  path: ['value'],
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

// ── Seguimientos (CRM ligero): Contactos + Actividades (historial) ──
// Un "contacto" es la persona; su historial vive en la subcolección
// `contacts/{id}/activities`. Sin embudo de ventas: el contacto está `active`
// (se le sigue dando seguimiento) o `closed` (ya compró / ya no interesa).
const CONTACT_SOURCES = ['facebook_ads', 'social_chat', 'whatsapp', 'marketplace', 'other'];
const CONTACT_TAGS = ['retail', 'reseller', 'wholesale', 'vip'];
const CONTACT_STATUS = ['active', 'closed'];
const ACTIVITY_TYPES = ['call', 'whatsapp', 'note', 'restock', 'meeting'];

// Crear / editar un contacto de Seguimientos.
const crmContactSchema = z.object({
  name: z.string().min(2, 'Nombre del cliente requerido').max(80),
  phone: z.string().max(20).optional().default(''),
  email: z.string().email('Correo inválido').optional().or(z.literal('')),
  product: z.string().max(120).optional().default(''),
  source: z.enum(CONTACT_SOURCES).optional().default('other'),
  tags: z.array(z.enum(CONTACT_TAGS)).max(8).optional().default([]),
  status: z.enum(CONTACT_STATUS).optional().default('active'),
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
  saleItemSchema,
  saleItemsSchema,
  createUserSchema,
  contactSchema,
  feedbackSchema,
  discountCodeSchema,
  purchaseSchema,
  migratedItemSchema,
  arrivalSchema,
  installmentSchema,
  installmentPaymentSchema,
  followupSchema,
  crmContactSchema,
  crmActivitySchema,
  CONTACT_SOURCES,
  CONTACT_TAGS,
  CONTACT_STATUS,
  ACTIVITY_TYPES,
};
