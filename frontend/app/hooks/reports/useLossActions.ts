// Capa de aplicación — acciones de "Pérdidas". Encapsula las mutaciones RTK Query,
// el try/catch y los toasts. Devuelve `true/false` para que el formulario decida si
// resetear/cerrar, sin saber nada de promesas ni de la forma del error del backend.
import { toast } from "sonner";
import { useCreateLossMutation, useUpdateLossMutation } from "~/store/api/reportsApi";
import type { LossInput, LossEditInput } from "~/schemas/losses";

export function useLossActions() {
  const [createMut, { isLoading: creating }] = useCreateLossMutation();
  const [updateMut, { isLoading: updating }] = useUpdateLossMutation();

  /** Crea una pérdida (decodifica "origin:productId"). Devuelve true si tuvo éxito. */
  async function createLoss(data: LossInput): Promise<boolean> {
    const [origin, productId] = data.product.split(":") as ["native" | "migrated", string];
    try {
      await createMut({
        date: data.date,
        origin,
        productId,
        quantity: data.quantity,
        category: data.category,
        reason: data.reason,
      }).unwrap();
      toast.success("Pérdida registrada y stock descontado.");
      return true;
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo registrar.");
      return false;
    }
  }

  /** Edita los metadatos de una pérdida (fecha/tipo/nota). */
  async function updateLoss(id: string, data: LossEditInput): Promise<boolean> {
    try {
      await updateMut({ id, ...data }).unwrap();
      toast.success("Pérdida actualizada.");
      return true;
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo actualizar.");
      return false;
    }
  }

  return { createLoss, updateLoss, creating, updating };
}
