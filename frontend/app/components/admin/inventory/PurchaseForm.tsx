// Formulario de registro de compra (China). Muestra Precio Unitario y Total
// calculados en vivo. Al guardar, la compra entra en estado "En tránsito".
import { useState } from "react";
import { useForm, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { purchaseFormSchema, type PurchaseFormInput } from "~/lib/validators";
import { useCreatePurchaseMutation, useGetPurchasesQuery } from "~/store/api/inventoryApi";
import { DateField } from "~/components/ui/DatePicker";
import { formatUsd } from "~/lib/utils";

// Valores vacíos: strings vacíos en TODOS los campos (incluidos los numéricos).
// RHF no limpia un input si le pasas `undefined`; con "" sí lo vacía de verdad.
// Se usan como defaultValues y al limpiar tras registrar.
const EMPTY_PURCHASE = {
  purchaseDate: "",
  lot: "",
  code: "",
  productName: "",
  quantity: "",
  costUnit: "",
  taxUnit: "",
} as unknown as DefaultValues<PurchaseFormInput>;

export function PurchaseForm() {
  const [createPurchase, { isLoading }] = useCreatePurchaseMutation();
  const { data: purchases = [] } = useGetPurchasesQuery();
  const [codeError, setCodeError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<PurchaseFormInput>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: EMPTY_PURCHASE,
  });

  const cost = Number(watch("costUnit")) || 0;
  const tax = Number(watch("taxUnit")) || 0;
  const qty = Number(watch("quantity")) || 0;
  const priceUnit = cost + tax;
  const total = priceUnit * qty;

  async function onSubmit(data: PurchaseFormInput) {
    try {
      await createPurchase(data).unwrap();
      toast.success("Compra registrada (En tránsito).");
      reset(EMPTY_PURCHASE);
      setCodeError(null);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo registrar la compra.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      autoComplete="off"
      className="grid gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <Field label="Fecha de compra" error={errors.purchaseDate?.message}>
        <DateField control={control} name="purchaseDate" invalid={!!errors.purchaseDate} />
      </Field>
      <Field label="Lote" error={errors.lot?.message}>
        <input className="input" {...register("lot")} />
      </Field>
      <Field label="Código" error={errors.code?.message}>
        {(() => {
          const { onBlur: rhfBlur, onChange: rhfChange, ...codeReg } = register("code");
          return (
            <>
              <input
                className="input"
                {...codeReg}
                onChange={(e) => { rhfChange(e); setCodeError(null); }}
                onBlur={(e) => {
                  rhfBlur(e);
                  const val = e.target.value.trim().toUpperCase();
                  if (val && purchases.some((p) => p.code.toUpperCase() === val)) {
                    setCodeError(`El código "${val}" ya está en uso.`);
                    toast.warning(`El código "${val}" ya está registrado en el inventario.`);
                  } else {
                    setCodeError(null);
                  }
                }}
              />
              {codeError && <span className="mt-1 block text-xs text-amber-400">⚠ {codeError}</span>}
            </>
          );
        })()}
      </Field>
      <div className="sm:col-span-2 lg:col-span-3">
        <Field label="Nombre del producto" error={errors.productName?.message}>
          <input className="input" {...register("productName")} />
        </Field>
      </div>
      <Field label="Cantidad" error={errors.quantity?.message}>
        <input type="number" min={1} className="input" {...register("quantity")} />
      </Field>
      <Field label="Precio base (USD)" error={errors.costUnit?.message}>
        <input type="number" step="0.01" min={0} className="input" {...register("costUnit")} />
      </Field>
      <Field label="Impuesto unitario (USD)" error={errors.taxUnit?.message}>
        <input type="number" step="0.0001" min={0} className="input" {...register("taxUnit")} />
      </Field>
      <div className="flex items-end gap-4 sm:col-span-2 lg:col-span-1">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Precio unitario</p>
          <p className="font-heading text-lg font-bold">{formatUsd(priceUnit, 4)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Total</p>
          <p className="font-heading text-lg font-bold text-accent-2">{formatUsd(total)}</p>
        </div>
      </div>
      <div className="flex items-end sm:col-span-2 lg:col-span-2">
        <Button type="submit" className="w-full" loading={isLoading}>
          Registrar compra
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
    </label>
  );
}
