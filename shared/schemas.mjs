// Fuente única de verdad de los schemas Zod compartidos entre el servidor
// (Express/CJS — los consume vía require(esm), disponible desde Node 20.19) y
// el frontend (Remix/Vite — los importa como ESM nativo).
//
// Regla: aquí vive el CONTRATO de la API. Cuando la UI necesita otra forma
// (p. ej. el selector combinado "origin:productId"), los forms extienden estas
// bases en frontend/app/schemas/* — nunca re-declaran los campos comunes.
//
// Los /** @type {[...]} */ fijan las tuplas literales para que TypeScript
// infiera los union types exactos (z.enum) también desde este archivo .mjs.
import { z } from "zod";

export const LOSS_CATEGORIES = /** @type {["robo", "daño", "devolucion", "regalias"]} */ (["robo", "daño", "devolucion", "regalias"]);
export const LOSS_ORIGINS = /** @type {["native", "migrated"]} */ (["native", "migrated"]);
export const CURRENCIES = /** @type {["C$", "USD"]} */ (["C$", "USD"]);

// Campos comunes de una pérdida de inventario (los comparten form y API).
export const lossBaseSchema = z.object({
  date: z.string().min(1, "Fecha requerida"),
  quantity: z.coerce.number().int().positive("Cantidad inválida"),
  category: z.enum(LOSS_CATEGORIES),
  reason: z.string().max(200).optional().default(""),
});

// Contrato del POST /api/reports/losses (producto separado en origin + id).
export const lossApiSchema = lossBaseSchema.extend({
  productId: z.string().min(1, "Producto requerido"),
  origin: z.enum(LOSS_ORIGINS).default("native"),
});

// Edición de pérdida: solo metadatos (producto y cantidad afectan stock/costo
// consumido por FIFO y no son reversibles con exactitud → no se editan).
export const lossEditSchema = z.object({
  date: z.string().min(1, "Fecha requerida"),
  category: z.enum(LOSS_CATEGORIES),
  reason: z.string().max(200).optional().default(""),
});

// Campos comunes de un gasto operativo. El `group` no vive aquí: la lista de
// grupos válidos es configuración del servidor → makeExpenseSchema(groupKeys).
export const expenseBaseSchema = z.object({
  date: z.string().min(1, "Fecha requerida"),
  amount: z.coerce.number().positive("Monto inválido"),
  currency: z.enum(CURRENCIES).default("C$"),
  subcategory: z.string().max(60).optional().default(""),
  reason: z.string().max(200).optional().default(""),
});

// Schema completo del gasto para el servidor, validando contra sus grupos.
/** @param {string[]} groupKeys */
export const makeExpenseSchema = (groupKeys) =>
  expenseBaseSchema.extend({
    group: z.string().refine((g) => groupKeys.includes(g), "Grupo inválido"),
  });

// ── Facturación (tickets POS) ────────────────────────────────────────────────

export const PAYMENT_METHODS = /** @type {["Efectivo", "Transferencia", "Tarjeta"]} */ (["Efectivo", "Transferencia", "Tarjeta"]);

// Línea de un ticket tal como la envía el TicketBuilder. El servidor resuelve
// productId/productName reales desde el código; el precio es negociable (la
// cajera lo ajusta si hubo regateo) y se valida contra el piso FIFO en el server.
export const invoiceItemInputSchema = z.object({
  productCode: z.string().min(1, "Código requerido"),
  // Origen del ítem: nativo (PRODUCTS) o migrado (MIGRATED_INVENTORY). El server
  // resuelve el migrado por doc id (productId), ya que sus códigos no son únicos.
  origin: z.enum(["native", "migrated"]).optional().default("native"),
  productId: z.string().optional().default(""),
  quantity: z.coerce.number().int().positive("Cantidad inválida"),
  unitPrice: z.coerce.number().nonnegative("Precio inválido"),
});

// Contrato del POST/PUT /api/invoices. El deliveryFee es SOLO informativo:
// se imprime para el cliente pero no entra al total (ni a comisiones/reportes).
export const invoiceBaseSchema = z.object({
  customer: z.object({
    firstName: z.string().max(60).optional().default(""),
    lastName: z.string().max(60).optional().default(""),
    phone: z.string().max(20).optional().default(""),
  }),
  items: z.array(invoiceItemInputSchema).min(1, "El ticket no tiene productos."),
  discount: z.coerce.number().nonnegative().optional().default(0),
  deliveryFee: z.coerce.number().nonnegative().optional().default(0),
  paymentMethod: z.enum(PAYMENT_METHODS).default("Efectivo"),
  assignedSeller: z.object({
    uid: z.string().min(1, "Vendedor requerido"),
    email: z.string().email("Correo del vendedor inválido"),
    name: z.string().min(1),
  }),
  contactId: z.string().nullable().optional().default(null),
});

// ── Schemas Consolidados Frontend / Server ──

const requiredPositiveNumber = (msg = "Requerido") =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? NaN : Number(v)),
    z.number({ invalid_type_error: msg }).positive(msg)
  );

const requiredNumber = (msg = "Requerido") =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? NaN : Number(v)),
    z.number({ invalid_type_error: msg }).nonnegative("No puede ser negativo")
  );

export const contactSchema = z.object({
  name: z.string().min(2, "Nombre muy corto").max(80),
  email: z.string().email("Correo inválido"),
  phone: z.string().max(20).optional().or(z.literal("")),
  message: z.string().min(5, "Mensaje muy corto").max(2000),
});

export const feedbackSchema = z.object({
  type: z.enum(["bug", "idea", "product"]),
  message: z.string().min(5, "Mensaje muy corto").max(2000),
  userPhone: z.string().min(7, "Teléfono inválido").max(20).optional().or(z.literal("")),
});

export const purchaseSchema = z.object({
  purchaseDate: z.string().min(1, "Fecha requerida"),
  lot: z
    .string()
    .min(1, "Lote requerido")
    .regex(/^LT\d+$/i, "Formato incorrecto (ej. LT1, LT4)"),
  code: z
    .string()
    .trim()
    .min(1, "Código requerido")
    .regex(/^IN\d+$/i, "Formato incorrecto (ej. IN1, IN13)"),
  productName: z.string().min(2, "Nombre requerido"),
  quantity: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? NaN : Number(v)),
    z.number({ invalid_type_error: "Requerido" }).int("Debe ser entero").positive("Debe ser mayor a 0")
  ),
  costUnit: requiredPositiveNumber("Precio base requerido"),
  taxUnit: requiredPositiveNumber("Impuesto requerido"),
  suggestedPrice: z.coerce.number().nonnegative("No puede ser negativo").optional(),
});

export const migratedItemSchema = z.object({
  purchaseDate: z.string().min(1, "Fecha requerida"),
  lot: z.string().optional(),
  code: z.string().min(1, "Código requerido"),
  productName: z.string().min(2, "Nombre requerido"),
  quantity: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? NaN : Number(v)),
    z.number({ invalid_type_error: "Requerido" }).int("Debe ser entero").positive("Debe ser mayor a 0")
  ),
  costUnit: requiredNumber("Precio base requerido"),
  shippingUnit: requiredNumber("Costo de envío requerido"),
  comments: z.string().optional(),
});

export const arrivalSchema = z.object({
  arrivalDate: z.string().min(1, "Fecha de ingreso requerida"),
  shippingUnit: z.coerce.number().nonnegative("No puede ser negativo"),
  category: z.string().min(1, "Selecciona una categoría"),
  suggestedPrice: z.coerce.number().nonnegative("No puede ser negativo").optional(),
});

export const installmentSchema = z.object({
  customerName: z.string().min(2, "Nombre del cliente requerido").max(80),
  customerPhone: z.string().min(7, "Teléfono inválido").max(20).optional().or(z.literal("")),
  sellerEmail: z.string().email("Correo inválido").optional().or(z.literal("")),
  sellerName: z.string().max(80).optional().or(z.literal("")),
  sellerUid: z.string().optional().or(z.literal("")), // Solo server, pero no estorba en UI
  items: z.array(z.object({
    productId: z.string().min(1),
    name: z.string().min(1),
    quantity: z.coerce.number().int().positive(),
    salePrice: z.coerce.number().nonnegative(),
  })).min(1, 'La venta debe tener al menos un producto').optional(), // Opcional en el form frontend
  totalAmount: z.coerce.number().positive("Monto total requerido"),
  numInstallments: z.coerce.number().int().min(2, "Mínimo 2 cuotas").max(24, "Máximo 24 cuotas"),
  installmentAmount: z.coerce.number().positive("Monto por cuota requerido"),
  firstPaymentDate: z.string().min(1, "Fecha del primer pago requerida"),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export const installmentPaymentSchema = z.object({
  amount: z.coerce.number().positive("El monto del pago es requerido"),
  paymentDate: z.string().min(1, "Fecha del pago requerida"),
  nextPaymentDate: z.string().optional().or(z.literal("")),
  paymentMethod: z.enum(["efectivo", "transferencia", "tarjeta"]).optional(),
  notes: z.string().max(300).optional().or(z.literal("")),
});
