// Barra de acciones para la selección de ventas pendientes. Presentacional: recibe
// las ventas seleccionadas y dispara callbacks. Las reglas (editar solo 1, no aprobar
// con stock insuficiente) salen del dominio.
import { Check, X, Pencil, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { canEditSelection, hasInsufficientStock } from "~/domain/sales/salesValidators";
import { formatCordobas } from "~/lib/utils";
import type { Sale } from "~/store/api/salesApi";

interface Props {
  sales: Sale[];
  paying: boolean;
  onEdit: () => void;
  onReject: () => void;
  onDelete: () => void;
  onApprove: () => void;
  onCancel: () => void;
}

export function SaleBulkActionBar({ sales, paying, onEdit, onReject, onDelete, onApprove, onCancel }: Props) {
  const single = canEditSelection(sales);

  return (
    <div className="flex items-center justify-between rounded-lg border border-accent-2/30 bg-accent-2/5 p-3 animate-in fade-in slide-in-from-top-2">
      <div className="text-sm">
        <span className="text-muted">{sales.length > 1 ? "Ventas seleccionadas: " : "Venta seleccionada: "}</span>
        {single ? (
          <>
            <span className="font-semibold text-text">{sales[0].sellerName}</span>
            <span className="ml-2 text-muted">({formatCordobas(sales[0].saleTotal)})</span>
          </>
        ) : (
          <span className="font-semibold text-text">{sales.length}</span>
        )}
      </div>
      <div className="flex gap-2">
        {single && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="mr-1.5 h-4 w-4" /> Editar
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onReject} className="border-danger/30 text-danger hover:bg-danger/10">
          <X className="mr-1.5 h-4 w-4" /> Rechazar
        </Button>
        <Button variant="outline" size="sm" onClick={onDelete} className="border-danger/30 text-danger hover:bg-danger/10">
          <Trash2 className="mr-1.5 h-4 w-4" /> Eliminar
        </Button>
        <Button size="sm" onClick={onApprove} disabled={paying || hasInsufficientStock(sales)} className="bg-accent/90 hover:bg-accent">
          <Check className="mr-1.5 h-4 w-4" /> Aprobar
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}
