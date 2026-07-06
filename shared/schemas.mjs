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
  quantity: z.coerce.number().int().positive("Cantidad inválida"),
  unitPrice: z.coerce.number().nonnegative("Precio inválido"),
});

// Contrato del POST/PUT /api/invoices. El deliveryFee es SOLO informativo:
// se imprime para el cliente pero no entra al total (ni a comisiones/reportes).
export const invoiceBaseSchema = z.object({
  customer: z.object({
    firstName: z.string().min(1, "Nombre del cliente requerido").max(60),
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
