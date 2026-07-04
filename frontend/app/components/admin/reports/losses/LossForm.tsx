// Formulario de alta de pérdida. Presentacional: el orden lo da el dominio
// (sortProductsByCode) y la mutación el hook (createLoss). Sin try/catch ni toasts aquí.
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "~/components/ui/Button";
import { DateField } from "~/components/ui/DatePicker";
import { Field } from "~/components/admin/reports/_shared/Field";
import { useGetLossProductsQuery } from "~/store/api/reportsApi";
import { sortProductsByCode } from "~/domain/reports/inventorySorter";
import { useLossActions } from "~/hooks/reports/useLossActions";
import { lossSchema, type LossInput } from "~/schemas/losses";

const today = () => new Date().toISOString().split("T")[0];

export function LossForm() {
  const { data: products = [] } = useGetLossProductsQuery();
  const { createLoss, creating } = useLossActions();

  const sortedProducts = useMemo(() => sortProductsByCode(products), [products]);

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<LossInput>({
    resolver: zodResolver(lossSchema),
    defaultValues: { date: today(), category: "daño", quantity: 1 },
  });

  async function onSubmit(data: LossInput) {
    const ok = await createLoss(data);
    if (ok) reset({ date: today(), category: "daño", quantity: 1, product: "", reason: "" });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
      <Field label="Fecha" error={errors.date?.message}>
        <DateField control={control} name="date" invalid={!!errors.date} />
      </Field>
      <Field label="Producto" error={errors.product?.message} className="lg:col-span-2">
        <select className="input" {...register("product")}>
          <option value="">Selecciona…</option>
          {sortedProducts.map((p) => (
            <option key={`${p.origin}:${p.id}`} value={`${p.origin}:${p.id}`}>
              {p.code} — {p.name} · stock {p.stock}{p.origin === "migrated" ? " · migrado" : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Cantidad" error={errors.quantity?.message}>
        <input type="number" min={1} step={1} className="input" {...register("quantity")} />
      </Field>
      <Field label="Tipo">
        <select className="input" {...register("category")}>
          <option value="daño">Daño</option>
          <option value="robo">Robo</option>
          <option value="devolucion">Devolución</option>
        </select>
      </Field>
      <Field label="Nota (opcional)" className="lg:col-span-4">
        <input className="input" placeholder="Descripción…" {...register("reason")} />
      </Field>
      <div className="flex items-end">
        <Button type="submit" loading={creating}>Registrar pérdida</Button>
      </div>
      <p className="text-xs text-muted lg:col-span-5">
        El monto de la pérdida es el costo real del producto (no el precio de venta) y se descuenta del inventario.
      </p>
    </form>
  );
}
