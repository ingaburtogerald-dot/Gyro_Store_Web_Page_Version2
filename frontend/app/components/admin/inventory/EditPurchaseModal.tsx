// Modal para editar los datos base de una compra en tránsito (China).
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { purchaseFormSchema, type PurchaseFormInput } from "~/lib/validators";
import { useUpdatePurchaseMutation, type Purchase } from "~/store/api/inventoryApi";
import { DateField } from "~/components/ui/DatePicker";
import { formatUsd } from "~/lib/utils";

export function EditPurchaseModal({
  purchase,
  onClose,
}: {
  purchase: Purchase | null;
  onClose: () => void;
}) {
  const [updatePurchase, { isLoading }] = useUpdatePurchaseMutation();

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<PurchaseFormInput>({
    resolver: zodResolver(purchaseFormSchema),
  });

  // Cargar datos actuales de la compra al abrir el modal.
  useEffect(() => {
    if (purchase) {
      reset({
        purchaseDate: purchase.purchaseDate || "",
        lot: purchase.lot || "",
        code: purchase.code || "",
        productName: purchase.productName || "",
        quantity: purchase.quantity,
        costUnit: purchase.costUnit,
        taxUnit: purchase.taxUnit,
      });
    }
  }, [purchase, reset]);

  // Cálculos en vivo.
  const cost = Number(watch("costUnit")) || 0;
  const tax = Number(watch("taxUnit")) || 0;
  const qty = Number(watch("quantity")) || 0;
  const priceUnit = cost + tax;
  const total = priceUnit * qty;

  async function onSubmit(data: PurchaseFormInput) {
    if (!purchase) return;
    try {
      await updatePurchase({ id: purchase.id, body: data }).unwrap();
      toast.success("Compra modificada correctamente.");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo actualizar la compra.");
    }
  }

  return (
    <Modal open={!!purchase} onClose={onClose} title={`Editar compra · ${purchase?.code ?? ""}`}>
      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Fecha de compra</span>
            <DateField control={control} name="purchaseDate" invalid={!!errors.purchaseDate} />
            {errors.purchaseDate && <span className="mt-1 block text-xs text-red-400">{errors.purchaseDate.message}</span>}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Lote</span>
            <input className="input" {...register("lot")} />
            {errors.lot && <span className="mt-1 block text-xs text-red-400">{errors.lot.message}</span>}
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Código</span>
            <input className="input" {...register("code")} />
            {errors.code && <span className="mt-1 block text-xs text-red-400">{errors.code.message}</span>}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Cantidad</span>
            <input type="number" min={1} className="input" {...register("quantity")} />
            {errors.quantity && <span className="mt-1 block text-xs text-red-400">{errors.quantity.message}</span>}
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Nombre del producto (usa | para variantes)</span>
          <input className="input" {...register("productName")} />
          {errors.productName && <span className="mt-1 block text-xs text-red-400">{errors.productName.message}</span>}
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Precio base (USD)</span>
            <input type="number" step="0.01" min={0} className="input" {...register("costUnit")} />
            {errors.costUnit && <span className="mt-1 block text-xs text-red-400">{errors.costUnit.message}</span>}
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">Impuesto unitario (USD)</span>
            <input type="number" step="0.0001" min={0} className="input" {...register("taxUnit")} />
            {errors.taxUnit && <span className="mt-1 block text-xs text-red-400">{errors.taxUnit.message}</span>}
          </label>
        </div>

        <div className="flex justify-between items-center bg-surface-2 p-3 rounded-lg border border-border">
          <div>
            <p className="text-xxs uppercase tracking-wider text-muted">Precio unitario</p>
            <p className="font-heading text-base font-bold">{formatUsd(priceUnit, 4)}</p>
          </div>
          <div className="text-right">
            <p className="text-xxs uppercase tracking-wider text-muted">Total</p>
            <p className="font-heading text-base font-bold text-accent-2">{formatUsd(total)}</p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button type="submit" loading={isLoading} className="bg-gradient-accent">
            Guardar cambios
          </Button>
        </div>
      </form>
    </Modal>
  );
}
