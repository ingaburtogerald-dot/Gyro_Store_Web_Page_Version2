// Formulario de registro de compra (China). Al guardar, la compra entra en estado "En tránsito".
import { useState } from "react";
import { useForm, Controller, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { purchaseFormSchema, type PurchaseFormInput } from "~/lib/validators";
import { useCreatePurchaseMutation, useGetPurchasesQuery } from "~/store/api/inventoryApi";
import { DateField } from "~/components/ui/DatePicker";
import { Autocomplete } from "~/components/ui/Autocomplete";
import { formatUsd } from "~/lib/utils";

const EMPTY_PURCHASE = {
  purchaseDate: "",
  lot: "",
  code: "",
  productName: "",
  quantity: "",
  costUnit: "",
  taxUnit: "",
} as unknown as DefaultValues<PurchaseFormInput>;

export function PurchaseForm({ onDone }: { onDone?: () => void } = {}) {
  const [createPurchase, { isLoading }] = useCreatePurchaseMutation();
  const { data: purchases = [] } = useGetPurchasesQuery();
  const [codeError, setCodeError] = useState<string | null>(null);
  const [showSuccessPrompt, setShowSuccessPrompt] = useState(false);
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
    mode: "onBlur",
  });

  const cost = Number(watch("costUnit")) || 0;
  const tax = Number(watch("taxUnit")) || 0;
  const qty = Number(watch("quantity")) || 0;
  const subtotal = cost * qty;
  const totalTax = tax * qty;
  const totalFinal = subtotal + totalTax;

  async function onSubmit(data: PurchaseFormInput) {
    // Normalizar a mayúsculas antes de guardar
    data.lot = data.lot.toUpperCase();
    data.code = data.code.toUpperCase();
    try {
      await createPurchase(data).unwrap();
      toast.success("Compra registrada (En tránsito).");
      setCodeError(null);
      setShowSuccessPrompt(true);
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo registrar la compra.");
    }
  }

  if (showSuccessPrompt) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-12 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold">¡Compra registrada con éxito!</h2>
          <p className="text-muted mt-1">La compra ha sido guardada con estado "En tránsito".</p>
        </div>
        <p className="font-medium mt-4">¿Deseas registrar otra compra?</p>
        <div className="flex w-full sm:w-auto gap-3 pt-4">
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => { reset(EMPTY_PURCHASE); setShowSuccessPrompt(false); onDone?.(); }}>
            No, volver
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={() => { reset(EMPTY_PURCHASE); setShowSuccessPrompt(false); }}>
            Sí, agregar otra
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="space-y-5 p-1">

      {/* ── Bloque 1: Datos del ítem ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Fila 1: Fecha + Lote */}
        <Field label="Fecha de compra" error={errors.purchaseDate?.message}>
          <DateField control={control} name="purchaseDate" invalid={!!errors.purchaseDate} />
        </Field>
        <Field label="Lote" error={errors.lot?.message}>
          <Controller
            control={control}
            name="lot"
            render={({ field }) => (
              <Autocomplete
                options={Array.from(new Set(purchases.map((p) => p.lot).filter(Boolean)))}
                value={field.value || ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                invalid={!!errors.lot}
              />
            )}
          />
        </Field>

        {/* Fila 1 cont. (lg): Código */}
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
                {codeError && <span className="mt-1 block text-xs text-warning">⚠ {codeError}</span>}
              </>
            );
          })()}
        </Field>

        {/* Fila 2: Nombre del producto — ancho completo */}
        <div className="sm:col-span-2 lg:col-span-3">
          <Field label="Nombre del producto" error={errors.productName?.message}>
            <Controller
              control={control}
              name="productName"
              render={({ field }) => (
                <Autocomplete
                  options={Array.from(new Set(purchases.map((p) => p.productName).filter(Boolean)))}
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
      </div>

      {/* ── Bloque 2: Datos financieros ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Cantidad" error={errors.quantity?.message}>
          <input type="number" min={1} className="input h-10" {...register("quantity")} />
        </Field>
        <Field label="Precio base (USD)" error={errors.costUnit?.message}>
          <input type="number" step="0.01" min={0} className="input h-10" {...register("costUnit")} />
        </Field>
        <Field label="Imp. unitario (USD)" error={errors.taxUnit?.message}>
          <input type="number" step="0.0001" min={0} className="input h-10" {...register("taxUnit")} />
        </Field>

        {/* Tarjeta de totales estilo ticket */}
        <div className="col-span-3 flex flex-col gap-2 rounded-xl border border-accent/20 bg-accent/5 p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Subtotal (Base × Cantidad)</span>
            <span className="font-medium text-text">{formatUsd(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Total de Impuestos (Imp × Cantidad)</span>
            <span className="font-medium text-text">+{formatUsd(totalTax, 4)}</span>
          </div>
          <div className="my-1 border-t border-accent/10" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-accent/70">Total Final</span>
            <span className="font-heading text-xl font-bold text-accent-2">{formatUsd(totalFinal)}</span>
          </div>
        </div>
      </div>

      <Button type="submit" className="w-full sm:w-auto" loading={isLoading}>
        Registrar compra
      </Button>
    </form>
  );
}
