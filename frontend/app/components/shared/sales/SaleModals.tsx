// Dispatcher de modales de ventas (admin). Renderiza el modal correcto según la
// máquina de "intents" del hook (unión discriminada → switch exhaustivo). Centraliza
// el ciclo de vida de TODOS los modales en un solo lugar.
import { ConfirmReasonModal } from "./ConfirmReasonModal";
import { MixedSellerModal, PaySuccessModal } from "./SaleNoticeModals";
import { ApproveAndPayModal } from "~/components/admin/sales/ApproveAndPayModal";
import { SaleEditorModal } from "~/components/admin/sales/SaleEditorModal";
import type { AdminSaleActions } from "~/hooks/sales/useAdminSaleActions";

export function SaleModals({ actions }: { actions: AdminSaleActions }) {
  const { modal, closeModal, clearSelection, confirmReject, confirmDelete, confirmApproveAndPay, loading } = actions;
  if (!modal) return null;

  // Editar y cerrar también limpia la selección (paridad con el comportamiento previo).
  const closeAndClear = () => {
    clearSelection();
    closeModal();
  };

  switch (modal.type) {
    case "edit":
      return <SaleEditorModal sale={modal.sale} onClose={closeAndClear} />;
    case "reject":
      return (
        <ConfirmReasonModal
          kind="reject"
          sales={modal.sales}
          loading={loading.rejecting}
          onClose={closeModal}
          onConfirm={(reason) => confirmReject(modal.sales, reason)}
        />
      );
    case "delete":
      return (
        <ConfirmReasonModal
          kind="delete"
          sales={modal.sales}
          loading={loading.deleting}
          onClose={closeModal}
          onConfirm={(reason) => confirmDelete(modal.sales, reason)}
        />
      );
    case "pay":
      return <ApproveAndPayModal sales={modal.sales} onClose={closeModal} onSubmit={confirmApproveAndPay} />;
    case "mixed-seller":
      return <MixedSellerModal onClose={closeModal} />;
    case "success":
      return <PaySuccessModal data={modal.data} onClose={closeModal} />;
    default:
      return null;
  }
}
