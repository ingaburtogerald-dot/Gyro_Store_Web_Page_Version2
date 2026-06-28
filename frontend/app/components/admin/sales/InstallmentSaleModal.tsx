// Modal para crear una venta en cuotas a partir de las líneas del cotizador.
// Solo admin. El stock se reserva/consume al crear y la comisión se paga completa.
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { CreditCard } from "lucide-react";
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
        {/* Ticket de monto total */}
        <div className="flex flex-col gap-1 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <span className="text-xs text-muted/70">Monto total de la venta</span>
          <span className="font-heading text-3xl font-bold text-emerald-400">{formatCordobas(totalAmount)}</span>
          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <span>{items.length} producto{items.length !== 1 ? "s" : ""}</span>
            {seller?.name && <span>Vendedor: <strong className="text-text">{seller.name}</strong></span>}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Cliente *</span>
            <input className="input bg-surface-2/30 hover:bg-surface-2 focus:ring-1 focus:ring-accent" placeholder="Nombre del cliente" {...register("customerName")} />
            {errors.customerName && <span className="mt-1 block text-xs text-red-400">{errors.customerName.message}</span>}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Teléfono</span>
            <input className="input bg-surface-2/30 hover:bg-surface-2 focus:ring-1 focus:ring-accent" placeholder="Opcional" {...register("customerPhone")} />
            {errors.customerPhone && <span className="mt-1 block text-xs text-red-400">{errors.customerPhone.message}</span>}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Nº de cuotas *</span>
              <input type="number" min={2} max={24} className="input bg-surface-2/30 hover:bg-surface-2 focus:ring-1 focus:ring-accent" {...register("numInstallments")} />
              {errors.numInstallments && <span className="mt-1 block text-xs text-red-400">{errors.numInstallments.message}</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Monto por cuota (C$) *</span>
              <input type="number" step="1" min={1} className="input bg-surface-2/30 hover:bg-surface-2 focus:ring-1 focus:ring-accent" {...register("installmentAmount")} />
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
            <input className="input bg-surface-2/30 hover:bg-surface-2 focus:ring-1 focus:ring-accent" placeholder="Opcional..." {...register("notes")} />
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={isLoading} className="group gap-2 shadow-md shadow-accent/20 hover:shadow-lg hover:shadow-accent/30">
              <CreditCard className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
              Crear venta en cuotas
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
