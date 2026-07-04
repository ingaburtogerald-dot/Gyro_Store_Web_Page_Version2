// Capa de aplicación — acciones de "Gastos". Mismo contrato que useLossActions:
// encapsula mutaciones + try/catch + toast y devuelve true/false.
import { toast } from "sonner";
import { useCreateExpenseMutation, useUpdateExpenseMutation } from "~/store/api/reportsApi";
import type { ExpenseInput } from "~/schemas/expenses";

export function useExpenseActions() {
  const [createMut, { isLoading: creating }] = useCreateExpenseMutation();
  const [updateMut, { isLoading: updating }] = useUpdateExpenseMutation();

  async function createExpense(data: ExpenseInput): Promise<boolean> {
    try {
      await createMut(data).unwrap();
      toast.success("Gasto registrado.");
      return true;
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo registrar.");
      return false;
    }
  }

  async function updateExpense(id: string, data: ExpenseInput): Promise<boolean> {
    try {
      await updateMut({ id, ...data }).unwrap();
      toast.success("Gasto actualizado.");
      return true;
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo actualizar.");
      return false;
    }
  }

  return { createExpense, updateExpense, creating, updating };
}
