// Modal para editar los datos de recepción de una compra (flete, categoría, fecha de ingreso).
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { arrivalFormSchema, type ArrivalFormInput } from "~/lib/validators";
import { useUpdatePurchaseMutation, type Purchase } from "~/store/api/inventoryApi";
import { useGetConfigQuery } from "~/store/api/catalogApi";
import { DateField } from "~/components/ui/DatePicker";

export function EditArrivalModal({
  purchase,
  onClose,
}: {
  purchase: Purchase | null;
  onClose: () => void;
}) {
  const { data: config } = useGetConfigQuery();
  const [updatePurchase, { isLoading }] = useUpdatePurchaseMutation();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ArrivalFormInput>({
    resolver: zodResolver(arrivalFormSchema),
  });

  // Cargar valores actuales al abrir el modal
  useEffect(() => {
    if (purchase) {
      reset({
        arrivalDate: purchase.arrivalDate || "",
        shippingUnit: purchase.shippingUnit,
        category: purchase.category || "",
      });
    }
  }, [purchase, reset]);

  async function onSubmit(data: ArrivalFormInput) {
    if (!purchase) return;
    try {
      // Combinamos los datos actuales con los campos de arribo editados
      const body = {
        ...purchase,
        arrivalDate: data.arrivalDate,
        shippingUnit: data.shippingUnit,
        category: data.category,
      };
      await updatePurchase({ id: purchase.id, body }).unwrap();
      toast.success("Datos de inventario actualizados correctamente.");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudieron guardar los cambios.");
    }
  }

  return (
    <Modal open={!!purchase} onClose={onClose} title={`Editar recepción · ${purchase?.code ?? ""}`}>
      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Fecha de ingreso a Nicaragua</span>
          <DateField control={control} name="arrivalDate" invalid={!!errors.arrivalDate} />
          {errors.arrivalDate && <span className="mt-1 block text-xs text-red-400">{errors.arrivalDate.message}</span>}
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Costo de envío unitario (USD)</span>
          <input type="number" step="0.0001" min={0} className="input" {...register("shippingUnit")} />
          {errors.shippingUnit && <span className="mt-1 block text-xs text-red-400">{errors.shippingUnit.message}</span>}
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Categoría</span>
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
          {errors.category && <span className="mt-1 block text-xs text-red-400">{errors.category.message}</span>}
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button type="submit" loading={isLoading} className="bg-gradient-accent text-white">
            Guardar cambios
          </Button>
        </div>
      </form>
    </Modal>
  );
}
