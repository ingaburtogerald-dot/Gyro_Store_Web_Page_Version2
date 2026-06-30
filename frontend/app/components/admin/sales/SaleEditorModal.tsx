// Modal de edición de una venta pendiente (envuelve SaleEditor).
import { Modal } from "~/components/ui/Modal";
import { SaleEditor } from "./SaleEditor";
import type { Sale } from "~/store/api/salesApi";

export function SaleEditorModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Editar Venta Pendiente" maxWidth="max-w-5xl">
      <div className="max-h-[80vh] overflow-y-auto pr-1">
        <SaleEditor sale={sale} onDone={onClose} />
      </div>
    </Modal>
  );
}
