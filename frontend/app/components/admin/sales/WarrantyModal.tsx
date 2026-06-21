// Modal para procesar un cambio por garantía sobre una venta aprobada/pagada.
// Descuenta 1 unidad del stock (nuevo ítem al cliente) y registra como pérdida.
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { useProcessWarrantyMutation, type Sale } from "~/store/api/salesApi";

interface Props {
  sale: Sale | null;
  onClose: () => void;
}

export function WarrantyModal({ sale, onClose }: Props) {
  const [processWarranty, { isLoading }] = useProcessWarrantyMutation();
  const [itemIndex, setItemIndex] = useState(0);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sale || !reason.trim()) return;
    try {
      await processWarranty({ id: sale.id, itemIndex, reason, notes }).unwrap();
      toast.success("Garantía procesada. Se descontó 1 unidad del inventario y se registró como pérdida.");
      setReason("");
      setNotes("");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo procesar la garantía.");
    }
  }

  if (!sale) return null;

  return (
    <Modal open={!!sale} onClose={onClose} title="Procesar Garantía / Cambio">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted leading-relaxed">
          Se entregará un nuevo ítem al cliente. El ítem de reemplazo se descontará del inventario
          y se registrará como pérdida.
        </p>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Producto a cambiar</span>
          <select
            className="input"
            value={itemIndex}
            onChange={(e) => setItemIndex(Number(e.target.value))}
          >
            {sale.items.map((item, i) => (
              <option key={i} value={i}>
                {item.name} × {item.quantity}
                {item.warrantyProcessed ? " (ya procesado)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Motivo de garantía *</span>
          <input
            className="input"
            placeholder="Ej: Producto defectuoso, cable roto..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Notas adicionales (opcional)</span>
          <textarea
            className="input min-h-[60px] resize-y"
            placeholder="Descripción del defecto, condiciones..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400 leading-normal">
          <strong className="block mb-1 text-amber-300 font-semibold">Nota:</strong>
          No se revierte la comisión del vendedor ni se anula la factura.
          Solo se descuenta 1 unidad nueva del inventario disponible.
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isLoading} disabled={!reason.trim()}>
            Confirmar garantía
          </Button>
        </div>
      </form>
    </Modal>
  );
}
