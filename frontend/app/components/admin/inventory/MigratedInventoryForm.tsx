// Formulario de carga MANUAL de inventario migrado (histórico del Excel viejo).
// Vive en su propia colección: no toca el inventario actual. Cada ítem guardado
// queda marcado con la bandera origin:'migrated'.
import { useState } from "react";
import { useForm, Controller, type DefaultValues } from "react-hook-form";
import { CheckCircle2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { migratedItemFormSchema, type MigratedItemFormInput } from "~/lib/validators";
import {
  useCreateMigratedItemMutation,
  useUpdateMigratedItemMutation,
  useGetMigratedInventoryQuery,
  type MigratedItem,
} from "~/store/api/inventoryApi";
import { DateField } from "~/components/ui/DatePicker";
import { Autocomplete } from "~/components/ui/Autocomplete";
import { formatUsd, formatCordobas } from "~/lib/utils";

const RATE = 37; // USD → C$ (igual que el server)

// Strings vacíos en TODOS los campos para que RHF los limpie de verdad al resetear.
const EMPTY_MIGRATED = {
  purchaseDate: "",
  lot: "",
  code: "",
  productName: "",
  quantity: "",
  costUnit: "",
  shippingUnit: "",
  comments: "",
} as unknown as DefaultValues<MigratedItemFormInput>;

export function MigratedInventoryForm({ item, onDone }: { item?: MigratedItem | null; onDone?: () => void } = {}) {
  const isEdit = !!item;
  const { data: existingItems = [] } = useGetMigratedInventoryQuery();
  const [createItem, { isLoading: creating }] = useCreateMigratedItemMutation();
  const [updateItem, { isLoading: updating }] = useUpdateMigratedItemMutation();
  const [showSuccessPrompt, setShowSuccessPrompt] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<MigratedItemFormInput>({
    resolver: zodResolver(migratedItemFormSchema),
    defaultValues: item
      ? ({
          purchaseDate: item.purchaseDate,
          lot: item.lot,
          code: item.code,
          productName: item.productName,
          quantity: item.quantity,
          costUnit: item.costUnit,
          shippingUnit: item.shippingUnit,
          comments: item.comments ?? "",
        } as unknown as DefaultValues<MigratedItemFormInput>)
      : EMPTY_MIGRATED,
  });

  const base = Number(watch("costUnit")) || 0;
  const ship = Number(watch("shippingUnit")) || 0;
  const priceUnitFinal = base + ship;
  const costeReal = priceUnitFinal * RATE;
  const sugerido = Math.round((costeReal * 1.40) / 10) * 10;

  async function onSubmit(data: MigratedItemFormInput) {
    const codeExists = existingItems.some(i => (i.code || "").toLowerCase() === data.code.toLowerCase() && i.id !== item?.id);
    if (codeExists) {
      toast.error(`El código "${data.code}" ya se encuentra registrado.`);
      return;
    }

    try {
      if (isEdit && item) {
        await updateItem({ id: item.id, body: data as any }).unwrap();
        toast.success("Ítem migrado actualizado.");
        onDone?.();
      } else {
        await createItem(data).unwrap();
        toast.success("Ítem migrado registrado.");
        setShowSuccessPrompt(true);
      }
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo guardar el ítem migrado.");
    }
  }

  if (showSuccessPrompt) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-12 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold">¡Ítem registrado con éxito!</h2>
          <p className="text-muted mt-1">El artículo ha sido guardado en el inventario migrado.</p>
        </div>
        <p className="font-medium mt-4">¿Deseas agregar otro ítem?</p>
        <div className="flex w-full sm:w-auto gap-3 pt-4">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none"
            onClick={() => {
              reset(EMPTY_MIGRATED);
              setShowSuccessPrompt(false);
              onDone?.();
            }}
          >
            No, volver
          </Button>
          <Button
            className="flex-1 sm:flex-none"
            onClick={() => {
              reset(EMPTY_MIGRATED);
              setShowSuccessPrompt(false);
            }}
          >
            Sí, agregar otro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      autoComplete="off"
      className="grid gap-3 rounded-card border border-warning/30 bg-warning/5 p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-2">
        <span className="rounded-pill bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
          🏷️ Migrado
        </span>
        <p className="text-xs text-muted">
          Datos históricos del Excel viejo. No afectan el inventario actual.
        </p>
      </div>

      <Field label="Fecha" error={errors.purchaseDate?.message}>
        <DateField control={control} name="purchaseDate" invalid={!!errors.purchaseDate} />
      </Field>
      <Field label="Lote" error={errors.lot?.message}>
        <Controller
          control={control}
          name="lot"
          render={({ field }) => (
            <Autocomplete
              options={Array.from(new Set(existingItems.map((i) => i.lot).filter(Boolean)))}
              value={field.value || ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              invalid={!!errors.lot}
            />
          )}
        />
      </Field>
      <Field label="Código" error={errors.code?.message}>
        <input className="input" {...register("code")} />
      </Field>

      <div className="sm:col-span-2 lg:col-span-3">
        <Field label="Nombre del producto" error={errors.productName?.message}>
          <Controller
            control={control}
            name="productName"
            render={({ field }) => (
              <Autocomplete
                options={Array.from(new Set(existingItems.map((i) => i.productName).filter(Boolean)))}
                value={field.value || ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                invalid={!!errors.productName}
              />
            )}
          />
        </Field>
      </div>

      <Field label="Entradas (cantidad)" error={errors.quantity?.message}>
        <input type="number" min={1} className="input" {...register("quantity")} />
      </Field>
      <Field label="Precio base (USD)" error={errors.costUnit?.message}>
        <input type="number" step="0.0001" min={0} className="input" {...register("costUnit")} />
      </Field>
      <Field label="Costo de envío unit. (USD)" error={errors.shippingUnit?.message}>
        <input type="number" step="0.0001" min={0} className="input" {...register("shippingUnit")} />
      </Field>

      {/* Preview calculado en vivo */}
      <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-6 rounded-card border border-border bg-surface/60 px-4 py-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">P. unit. final</p>
          <p className="font-heading text-base font-bold">{formatUsd(priceUnitFinal, 4)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Coste real unit.</p>
          <p className="font-heading text-base font-bold">{formatCordobas(costeReal)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">P. sugerido (+40%)</p>
          <p className="font-heading text-base font-bold text-accent-2">{formatCordobas(sugerido)}</p>
        </div>
      </div>

      <div className="sm:col-span-2 lg:col-span-3">
        <Field label="Comentarios" error={errors.comments?.message}>
          <input className="input" placeholder="Opcional" {...register("comments")} />
        </Field>
      </div>

      <div className="flex items-end sm:col-span-2 lg:col-span-3">
        <Button type="submit" className="w-full sm:w-auto" loading={creating || updating}>
          {isEdit ? "Guardar cambios" : "Registrar ítem migrado"}
        </Button>
      </div>
    </form>
  );
}
