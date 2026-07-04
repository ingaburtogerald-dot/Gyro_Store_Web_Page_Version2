// Edición de metadatos de una pérdida (producto/cantidad son de solo lectura: afectan
// stock y costo real). Consume useLossActions.updateLoss.
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "~/components/ui/Button";
import { DateField } from "~/components/ui/DatePicker";
import { Field } from "~/components/admin/reports/_shared/Field";
import { useLossActions } from "~/hooks/reports/useLossActions";
import { lossEditSchema, type LossEditInput } from "~/schemas/losses";
import type { LossRecord, LossCategory } from "~/store/api/reportsApi";

export function LossEditForm({ loss, onDone }: { loss: LossRecord; onDone: () => void }) {
  const { updateLoss, updating } = useLossActions();
  const { register, control, handleSubmit, formState: { errors } } = useForm<LossEditInput>({
    resolver: zodResolver(lossEditSchema),
    defaultValues: { date: loss.date, category: (loss.category as LossCategory) ?? "daño", reason: loss.reason || "" },
  });

  async function onSubmit(data: LossEditInput) {
    if (await updateLoss(loss.id, data)) onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2">
      <Field label="Producto" className="sm:col-span-2">
        <input
          className="input opacity-60"
          value={`${loss.productCode ? `${loss.productCode} — ` : ""}${loss.productName ?? ""}`}
          disabled
          readOnly
        />
      </Field>
      <Field label="Fecha" error={errors.date?.message}>
        <DateField control={control} name="date" invalid={!!errors.date} />
      </Field>
      <Field label="Cantidad">
        <input className="input opacity-60" value={loss.quantity ?? ""} disabled readOnly />
      </Field>
      <Field label="Tipo">
        <select className="input" {...register("category")}>
          <option value="daño">Daño</option>
          <option value="robo">Robo</option>
          <option value="devolucion">Devolución</option>
        </select>
      </Field>
      <Field label="Nota (opcional)" className="sm:col-span-2">
        <input className="input" placeholder="Descripción…" {...register("reason")} />
      </Field>
      <p className="text-xs text-muted sm:col-span-2">
        El producto y la cantidad no se editan aquí: afectan el stock y el costo real. Para corregirlos, registra una nueva pérdida.
      </p>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" loading={updating}>Guardar cambios</Button>
      </div>
    </form>
  );
}
