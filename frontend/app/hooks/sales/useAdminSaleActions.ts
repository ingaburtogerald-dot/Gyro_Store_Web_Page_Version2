// ─────────────────────────────────────────────────────────────────────────────
// Capa de Aplicación — Orquesta las ACCIONES de admin sobre ventas pendientes.
//
// Responsabilidades:
//   • Estado de selección (Set<id>) y su API (toggle / selectAll / clear).
//   • Máquina de "intents" de modal (editar / rechazar / eliminar / pagar / …).
//   • Mutaciones RTK Query con manejo de errores CENTRALIZADO (try/catch + toast).
//
// El componente container solo invoca estos handlers; no sabe de RTK ni de toasts.
// Las reglas de negocio (mismo vendedor, stock) se delegan al dominio.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useApproveAndPayBulkMutation,
  useRejectSaleMutation,
  useDeleteSaleMutation,
  type Sale,
} from "~/store/api/salesApi";
import { checkBulkApprove } from "~/domain/sales/salesValidators";

export interface ApprovePaySuccess {
  receiptUrl: string;
  whatsappUrl?: string;
  notifiedVia: string;
}

/** Estados de modal posibles. Una unión discriminada evita banderas booleanas sueltas. */
export type SaleModal =
  | { type: "edit"; sale: Sale }
  | { type: "reject"; sales: Sale[] }
  | { type: "delete"; sales: Sale[] }
  | { type: "pay"; sales: Sale[] }
  | { type: "mixed-seller" }
  | { type: "success"; data: ApprovePaySuccess }
  | null;

export function useAdminSaleActions(allSales: Sale[]) {
  const [reject, { isLoading: rejecting }] = useRejectSaleMutation();
  const [del, { isLoading: deleting }] = useDeleteSaleMutation();
  const [approveAndPayBulk, { isLoading: paying }] = useApproveAndPayBulkMutation();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<SaleModal>(null);

  const selectedSales = useMemo(
    () => allSales.filter((s) => selected.has(s.id)),
    [allSales, selected],
  );

  // ── Selección ──────────────────────────────────────────────────────────────
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(
    (select: boolean) => setSelected(select ? new Set(allSales.map((s) => s.id)) : new Set()),
    [allSales],
  );

  const clearSelection = useCallback(() => setSelected(new Set()), []);
  const closeModal = useCallback(() => setModal(null), []);

  // ── Intents (abren modales; no mutan todavía) ───────────────────────────────
  const beginEdit = useCallback((sale: Sale) => setModal({ type: "edit", sale }), []);
  const beginReject = useCallback((sales: Sale[]) => setModal({ type: "reject", sales }), []);
  const beginDelete = useCallback((sales: Sale[]) => setModal({ type: "delete", sales }), []);

  const beginBulkApprove = useCallback((sales: Sale[]) => {
    const check = checkBulkApprove(sales);
    if (check.ok) {
      setModal({ type: "pay", sales });
      return;
    }
    if (check.reason === "mixed-seller") setModal({ type: "mixed-seller" });
    else if (check.reason === "insufficient-stock") toast.error("Hay ventas con stock insuficiente.");
  }, []);

  // ── Confirmaciones (mutan; try/catch + toast en UN solo lugar) ──────────────
  const confirmReject = useCallback(
    async (sales: Sale[], reason: string) => {
      try {
        await Promise.all(sales.map((s) => reject({ id: s.id, reason }).unwrap()));
        toast.success(sales.length > 1 ? "Ventas rechazadas." : "Venta rechazada.");
        clearSelection();
        closeModal();
      } catch (err: any) {
        toast.error(err?.data?.error || "No se pudo rechazar.");
      }
    },
    [reject, clearSelection, closeModal],
  );

  const confirmDelete = useCallback(
    async (sales: Sale[], reason: string) => {
      try {
        await Promise.all(sales.map((s) => del({ id: s.id, reason }).unwrap()));
        toast.success(sales.length > 1 ? "Ventas eliminadas." : "Venta eliminada.");
        clearSelection();
        closeModal();
      } catch (err: any) {
        toast.error(err?.data?.error || "No se pudo eliminar.");
      }
    },
    [del, clearSelection, closeModal],
  );

  const confirmApproveAndPay = useCallback(
    async (form: FormData): Promise<ApprovePaySuccess | undefined> => {
      try {
        const data = (await approveAndPayBulk(form).unwrap()) as ApprovePaySuccess;
        toast.success("Pago procesado exitosamente.");
        clearSelection();
        setModal({ type: "success", data });
        return data;
      } catch (err: any) {
        toast.error(err?.data?.error || "Error al procesar el pago.");
        return undefined;
      }
    },
    [approveAndPayBulk, clearSelection],
  );

  return {
    // selección
    selected,
    selectedSales,
    toggle,
    selectAll,
    clearSelection,
    isAllSelected: allSales.length > 0 && selected.size === allSales.length,
    // modales
    modal,
    closeModal,
    beginEdit,
    beginReject,
    beginDelete,
    beginBulkApprove,
    confirmReject,
    confirmDelete,
    confirmApproveAndPay,
    // flags de carga (para deshabilitar botones)
    loading: { rejecting, deleting, paying },
  };
}

export type AdminSaleActions = ReturnType<typeof useAdminSaleActions>;
