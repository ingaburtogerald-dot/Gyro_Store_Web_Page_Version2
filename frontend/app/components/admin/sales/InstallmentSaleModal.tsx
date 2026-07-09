// Modal para crear una venta en cuotas a partir de las líneas del cotizador.
// Solo admin. El stock se reserva/consume al crear y la comisión se paga completa.
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
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
        <div className="flex flex-col gap-1 rounded-xl border border-accent/20 bg-accent/5 p-4">
          <span className="text-xs text-muted/70">Monto total de la venta</span>
          <span className="font-heading text-3xl font-bold text-accent-2">{formatCordobas(totalAmount)}</span>
          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <span>{items.length} producto{items.length !== 1 ? "s" : ""}</span>
            {seller?.name && <span>Vendedor: <strong className="text-text">{seller.name}</strong></span>}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Field label="Cliente *" error={errors.customerName?.message}>
            <input className="input" placeholder="Nombre del cliente" {...register("customerName")} />
          </Field>
          <Field label="Teléfono" error={errors.customerPhone?.message}>
            <input className="input" placeholder="Opcional" {...register("customerPhone")} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nº de cuotas *" error={errors.numInstallments?.message}>
              <input type="number" min={2} max={24} className="input" {...register("numInstallments")} />
            </Field>
            <Field label="Monto por cuota (C$) *" error={errors.installmentAmount?.message}>
              <input type="number" step="1" min={1} className="input" {...register("installmentAmount")} />
            </Field>
          </div>

          <Field label="Fecha del primer pago *" error={errors.firstPaymentDate?.message}>
            <DateField control={control} name="firstPaymentDate" invalid={!!errors.firstPaymentDate} />
          </Field>
          <Field label="Notas">
            <input className="input" placeholder="Opcional..." {...register("notes")} />
          </Field>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" size="sm" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" loading={isLoading}>
              <CreditCard className="h-4 w-4" />
              Crear venta en cuotas
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
