// Formulario de alta de pérdida. Presentacional: el orden lo da el dominio
// (sortProductsByCode) y la mutación el hook (createLoss). Sin try/catch ni toasts aquí.
import { useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Tag } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { DateField } from "~/components/ui/DatePicker";
import { Field } from "~/components/admin/reports/_shared/Field";
import { Select } from "~/components/admin/reports/_shared/Select";
import { ProductAutocomplete } from "~/components/admin/sales/ProductAutocomplete";
import { formStagger, fieldItem } from "~/components/admin/reports/_shared/motion";
import { useGetLossProductsQuery } from "~/store/api/reportsApi";
import { sortProductsByCode } from "~/domain/reports/inventorySorter";
import { useLossActions } from "~/hooks/reports/useLossActions";
import { lossSchema, type LossInput } from "~/schemas/losses";
import { cn } from "~/lib/utils";

const today = () => new Date().toISOString().split("T")[0];

// `bare` = sin la tarjeta contenedora (cuando vive dentro del modal, que ya es superficie).
export function LossForm({ bare, onDone }: { bare?: boolean; onDone?: () => void } = {}) {
  const { data: products = [] } = useGetLossProductsQuery();
  const { createLoss, creating } = useLossActions();

  const sortedProducts = useMemo(() => sortProductsByCode(products), [products]);
  // El combobox trabaja con un id compuesto "origin:productId" (lo que el hook espera).
  const productOptions = useMemo(
    () => sortedProducts.map((p) => ({ id: `${p.origin}:${p.id}`, code: p.code, name: p.name, stock: p.stock, origin: p.origin })),
    [sortedProducts],
  );

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<LossInput>({
    resolver: zodResolver(lossSchema),
    defaultValues: { date: today(), category: "daño", quantity: 1 },
  });

  async function onSubmit(data: LossInput) {
    const ok = await createLoss(data);
    if (!ok) return;
    reset({ date: today(), category: "daño", quantity: 1, product: "", reason: "" });
    onDone?.();
  }

  return (
    <motion.form
      variants={formStagger}
      initial="hidden"
      animate="show"
      onSubmit={handleSubmit(onSubmit)}
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2",
        !bare &&
          "rounded-card border border-border bg-surface p-5 transition-all duration-300 focus-within:border-accent/30 focus-within:shadow-[0_0_0_4px_rgba(16,185,129,0.06)]",
      )}
    >
      <motion.div variants={fieldItem} className="sm:col-span-2">
        <Field label="Producto" error={errors.product?.message}>
          <Controller
            control={control}
            name="product"
            render={({ field }) => (
              <ProductAutocomplete
                products={productOptions}
                value={field.value || ""}
                onChange={field.onChange}
                invalid={!!errors.product}
              />
            )}
          />
        </Field>
      </motion.div>

      <motion.div variants={fieldItem}>
        <Field label="Fecha" error={errors.date?.message}>
          <DateField control={control} name="date" invalid={!!errors.date} />
        </Field>
      </motion.div>

      <motion.div variants={fieldItem}>
        <Field label="Cantidad" error={errors.quantity?.message}>
          <input type="number" min={1} step={1} className="input" {...register("quantity")} />
        </Field>
      </motion.div>

      <motion.div variants={fieldItem}>
        <Field label="Tipo">
          <Select icon={Tag} {...register("category")}>
            <option value="daño">Daño</option>
            <option value="robo">Robo</option>
            <option value="devolucion">Devolución</option>
            <option value="regalias">Regalías</option>
          </Select>
        </Field>
      </motion.div>

      <motion.div variants={fieldItem}>
        <Field label="Nota (opcional)">
          <input className="input" placeholder="Descripción…" {...register("reason")} />
        </Field>
      </motion.div>

      <motion.div variants={fieldItem} className="sm:col-span-2 flex justify-end pt-1">
        <Button type="submit" loading={creating}>Registrar pérdida</Button>
      </motion.div>

      <motion.p variants={fieldItem} className="sm:col-span-2 text-xs text-muted">
        El monto de la pérdida es el costo real del producto (no el precio de venta) y se descuenta del inventario.
      </motion.p>
    </motion.form>
  );
}
