// Esquemas Zod del frontend (validación de formularios con React Hook Form).
// Comparten forma con server/utils/validators.js donde aplica.
import { z } from "zod";
import {
  contactSchema,
  feedbackSchema,
  purchaseSchema as purchaseFormSchema,
  migratedItemSchema as migratedItemFormSchema,
  arrivalSchema as arrivalFormSchema,
  installmentSchema as installmentFormSchema,
  installmentPaymentSchema,
} from "@shared/schemas.mjs";

export const loginSchema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const checkoutSchema = z
  .object({
    customerName: z.string().min(2, "Ingresa tu nombre").max(80),
    customerPhone: z.string().min(7, "Teléfono inválido").max(20),
    deliveryMethod: z.enum(["retiro", "envio"]),
    address: z.string().max(200).optional().or(z.literal("")),
    // Link de Google Maps con el pin GPS del cliente (opcional, lo llena el botón).
    locationUrl: z.string().max(300).optional().or(z.literal("")),
    note: z.string().max(500).optional().or(z.literal("")),
  })
  // En envío pedimos dirección escrita O ubicación GPS (al menos una).
  .refine(
    (d) => d.deliveryMethod !== "envio" || (d.address && d.address.length > 4) || !!d.locationUrl,
    { message: "Agrega tu dirección o comparte tu ubicación", path: ["address"] },
  );
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export {
  contactSchema,
  feedbackSchema,
  purchaseFormSchema,
  migratedItemFormSchema,
  arrivalFormSchema,
  installmentFormSchema,
  installmentPaymentSchema,
};

export type ContactInput = z.infer<typeof contactSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type PurchaseFormInput = z.infer<typeof purchaseFormSchema>;
export type MigratedItemFormInput = z.infer<typeof migratedItemFormSchema>;
export type ArrivalFormInput = z.infer<typeof arrivalFormSchema>;
export type InstallmentFormInput = z.infer<typeof installmentFormSchema>;
export type InstallmentPaymentInput = z.infer<typeof installmentPaymentSchema>;
