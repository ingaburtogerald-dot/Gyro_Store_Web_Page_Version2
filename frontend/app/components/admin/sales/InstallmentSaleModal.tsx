// Modal para crear una venta en cuotas a partir de las líneas del cotizador.
// Solo admin. El stock se reserva/consume al crear y la comisión se paga completa.
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { useCreateInstallmentMutation } from "~/store/api/installmentsApi";
import { installmentFormSchema, type InstallmentFormInput } from "~/lib/validators";
import { DateField } from "~/components/ui/DatePicker";
import { formatCordobas } from "~/lib/utils";

interface InstallmentItem {
  productId: string;
  name: string;
  quantity: number;
  salePrice: number;
}

const today = () => new Date().toISOString().split("T")[0];

export function InstallmentSaleModal({
  open,
  onClose,
  items,
  totalAmount,
  seller,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  items: InstallmentItem[];
  totalAmount: number;
  seller?: { email: string; name: string; uid: string };
  onCreated: () => void;
}) {
  const [createInstallment, { isLoading }] = useCreateInstallmentMutation();
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<InstallmentFormInput>({
    resolver: zodResolver(installmentFormSchema),
    defaultValues: { numInstallments: 2, firstPaymentDate: today() },
  });

  const numInstallments = watch("numInstallments");

  // Sugerir el monto por cuota = total / nº de cuotas cuando cambian.
  useEffect(() => {
    const n = Number(numInstallments);
    if (totalAmount > 0 && n >= 2) {
      setValue("installmentAmount", Math.round(totalAmount / n));
    }
  }, [numInstallments, totalAmount, setValue]);

  async function onSubmit(data: InstallmentFormInput) {
    if (items.length === 0) return toast.error("Agrega al menos un producto válido.");
    try {
      await createInstallment({
        customerName: data.customerName,
        customerPhone: data.customerPhone || "",
        sellerEmail: seller?.email || "",
        sellerName: seller?.name || "",
        sellerUid: seller?.uid || "",
        items,
        totalAmount,
        numInstallments: data.numInstallments,
        installmentAmount: data.installmentAmount,
        firstPaymentDate: data.firstPaymentDate,
        notes: data.notes || "",
      }).unwrap();
      toast.success("Venta en cuotas creada. El stock fue descontado.");
      reset({ numInstallments: 2, firstPaymentDate: today() });
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo crear la venta en cuotas.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Vender en cuotas">
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted">{items.length} producto(s)</span>
            <span className="font-bold text-text">{formatCordobas(totalAmount)}</span>
          </div>
          {seller?.name && <p className="text-xs text-muted">Vendedor: {seller.name}</p>}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Cliente *</span>
            <input className="input" placeholder="Nombre del cliente" {...register("customerName")} />
            {errors.customerName && <span className="mt-1 block text-xs text-red-400">{errors.customerName.message}</span>}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Teléfono</span>
            <input className="input" placeholder="Opcional" {...register("customerPhone")} />
            {errors.customerPhone && <span className="mt-1 block text-xs text-red-400">{errors.customerPhone.message}</span>}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Nº de cuotas *</span>
              <input type="number" min={2} max={24} className="input" {...register("numInstallments")} />
              {errors.numInstallments && <span className="mt-1 block text-xs text-red-400">{errors.numInstallments.message}</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Monto por cuota (C$) *</span>
              <input type="number" step="1" min={1} className="input" {...register("installmentAmount")} />
              {errors.installmentAmount && <span className="mt-1 block text-xs text-red-400">{errors.installmentAmount.message}</span>}
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Fecha del primer pago *</span>
            <DateField control={control} name="firstPaymentDate" invalid={!!errors.firstPaymentDate} />
            {errors.firstPaymentDate && <span className="mt-1 block text-xs text-red-400">{errors.firstPaymentDate.message}</span>}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Notas</span>
            <input className="input" placeholder="Opcional..." {...register("notes")} />
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={isLoading}>Crear venta en cuotas</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
