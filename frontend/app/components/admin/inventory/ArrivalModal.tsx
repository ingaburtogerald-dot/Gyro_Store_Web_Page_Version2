// Modal "Reportar llegada a Nicaragua": fecha de ingreso, costo de envío unitario
// y categoría. Al confirmar, la compra pasa a "Pendiente de aprobación".
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { arrivalFormSchema, type ArrivalFormInput } from "~/lib/validators";
import { useReportArrivalMutation, type Purchase } from "~/store/api/inventoryApi";
import { useGetConfigQuery } from "~/store/api/catalogApi";
import { DateField } from "~/components/ui/DatePicker";

export function ArrivalModal({
  purchase,
  onClose,
}: {
  purchase: Purchase | null;
  onClose: () => void;
}) {
  const { data: config } = useGetConfigQuery();
  const [reportArrival, { isLoading }] = useReportArrivalMutation();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ArrivalFormInput>({
    resolver: zodResolver(arrivalFormSchema),
    defaultValues: { arrivalDate: undefined, shippingUnit: undefined },
  });

  async function onSubmit(data: ArrivalFormInput) {
    if (!purchase) return;
    try {
      await reportArrival({ id: purchase.id, body: data }).unwrap();
      toast.success("Llegada reportada. Pendiente de aprobación.");
      reset();
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo reportar la llegada.");
    }
  }

  return (
    <Modal open={!!purchase} onClose={onClose} title={`Reportar llegada · ${purchase?.code ?? ""}`}>
      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="space-y-3">
        <Field label="Fecha de ingreso a Nicaragua" error={errors.arrivalDate?.message}>
          <DateField control={control} name="arrivalDate" invalid={!!errors.arrivalDate} />
        </Field>

        <Field label="Costo de envío unitario (USD)" error={errors.shippingUnit?.message}>
          <input type="number" step="0.0001" min={0} className="input" {...register("shippingUnit")} />
        </Field>

        <Field label="Categoría" error={errors.category?.message}>
          <select className="input" defaultValue="" {...register("category")}>
            <option value="" disabled>
              Selecciona una categoría
            </option>
            {config?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" size="sm" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button type="submit" size="sm" loading={isLoading}>
            Confirmar llegada
          </Button>
        </div>
      </form>
    </Modal>
  );
}
