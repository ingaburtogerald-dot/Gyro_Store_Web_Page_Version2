// Esquemas de validación (Zod) del dominio "Gastos operativos".
// La base viene de shared/schemas.mjs (la misma fuente que valida el servidor).
// La lista de grupos válidos es configuración del servidor: aquí el form solo
// exige que haya grupo; el servidor lo valida contra config.expenseGroups.
import { z } from "zod";
import { expenseBaseSchema } from "@shared/schemas.mjs";

export const expenseSchema = expenseBaseSchema.extend({
  group: z.string().min(1, "Grupo requerido"),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;
