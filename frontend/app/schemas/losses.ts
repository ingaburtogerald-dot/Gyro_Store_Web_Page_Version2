// Esquemas de validación (Zod) del dominio "Pérdidas de inventario".
// La base y la edición vienen de shared/schemas.mjs (la MISMA fuente que valida
// el servidor); el alta del form solo añade el campo combinado del selector.
import { z } from "zod";
import { lossBaseSchema, lossEditSchema } from "@shared/schemas.mjs";

/** Alta de pérdida: se elige producto (codificado "origin:productId") y cantidad. */
export const lossSchema = lossBaseSchema.extend({
  product: z.string().min(1, "Producto requerido"), // "origin:productId"
});
export type LossInput = z.infer<typeof lossSchema>;

/** Edición: solo metadatos (producto y cantidad afectan stock/costo → no editables). */
export { lossEditSchema };
export type LossEditInput = z.infer<typeof lossEditSchema>;
