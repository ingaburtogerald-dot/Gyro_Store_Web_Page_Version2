// Modal de confirmación con motivo obligatorio. Sirve para RECHAZAR y ELIMINAR
// (mismo formulario, distinto copy/severidad). Presentacional puro: el padre decide
// qué mutación correr vía `onConfirm(reason)`.
import { useState } from "react";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { formatCordobas } from "~/lib/utils";
import type { Sale } from "~/store/api/salesApi";

interface Props {
  kind: "reject" | "delete";
  sales: Sale[];
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}

export function ConfirmReasonModal({ kind, sales, onClose, onConfirm, loading }: Props) {
  const [reason, setReason] = useState("");
  const isDelete = kind === "delete";
  const single = sales.length === 1;

  return (
    <Modal open onClose={onClose} title={isDelete ? "Eliminar venta" : "Rechazar venta"}>
      <div className="space-y-4">
        <p className="text-sm text-muted">
          {isDelete ? (
            single ? (
              <>¿Eliminar por completo la venta de <strong className="text-text">{sales[0].sellerName}</strong> por <strong>{formatCordobas(sales[0].saleTotal)}</strong>? Se liberará el stock reservado. Esta acción no se puede deshacer.</>
            ) : (
              <>¿Eliminar por completo las <strong>{sales.length} ventas</strong> seleccionadas? Se liberará el stock reservado de todas ellas. Esta acción no se puede deshacer.</>
            )
          ) : single ? (
            <>Venta de <strong className="text-text">{sales[0].sellerName}</strong> por un total de <strong>{formatCordobas(sales[0].saleTotal)}</strong>.</>
          ) : (
            <>Estás a punto de rechazar <strong>{sales.length} ventas</strong> seleccionadas.</>
          )}
        </p>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-muted">
            {isDelete ? "Motivo de la eliminación (obligatorio)" : "Motivo del rechazo (obligatorio)"}
          </span>
          <textarea
            className="input"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isDelete
              ? "Indica por qué se elimina esta venta (queda en auditoría)…"
              : "Indica el motivo de rechazo que se enviará al vendedor por correo…"}
          />
        </label>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            variant={isDelete ? "primary" : "outline"}
            size="sm"
            loading={loading}
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
            className={isDelete ? "bg-danger/90 hover:bg-danger" : "border-danger/40 text-danger hover:bg-danger/10"}
          >
            {isDelete ? "Eliminar" : "Rechazar Venta"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
