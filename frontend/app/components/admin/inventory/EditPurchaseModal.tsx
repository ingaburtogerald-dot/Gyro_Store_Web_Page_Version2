// Modal para editar los datos base de una compra en tránsito (China).
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { purchaseFormSchema, type PurchaseFormInput } from "~/lib/validators";
import { useUpdatePurchaseMutation, useGetPurchasesQuery, type Purchase } from "~/store/api/inventoryApi";
import { DateField } from "~/components/ui/DatePicker";
import { formatUsd } from "~/lib/utils";

export function EditPurchaseModal({ purchase, onClose }: { purchase: Purchase | null; onClose: () => void }) {
  const [updatePurchase, { isLoading }] = useUpdatePurchaseMutation();
  const { data: purchases = [] } = useGetPurchasesQuery();
  const [codeWarn, setCodeWarn] = useState<string | null>(null);

  const { register, control, handleSubmit, watch, reset, formState: { errors } } = useForm<PurchaseFormInput>({
    resolver: zodResolver(purchaseFormSchema),
    mode: "onBlur",
  });

  useEffect(() => {
    if (purchase) {
      reset({
        purchaseDate: purchase.purchaseDate || "",
        lot: purchase.lot || "",
        code: purchase.code || "",
        productName: purchase.productName || "",
        quantity: purchase.quantity,
        costUnit: purchase.costUnit,
        taxUnit: purchase.taxUnit,
      });
    }
  }, [purchase, reset]);

  const cost = Number(watch("costUnit")) || 0;
  const tax = Number(watch("taxUnit")) || 0;
  const qty = Number(watch("quantity")) || 0;
  const subtotal = cost * qty;
  const totalTax = tax * qty;
  const totalFinal = subtotal + totalTax;

  async function onSubmit(data: PurchaseFormInput) {
    if (!purchase) return;
    data.lot = data.lot.toUpperCase();
    data.code = data.code.toUpperCase();
    try {
      await updatePurchase({ id: purchase.id, body: data }).unwrap();
      toast.success("Compra modificada correctamente.");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo actualizar la compra.");
    }
  }

  return (
    <Modal open={!!purchase} onClose={onClose} title={`Editar compra · ${purchase?.code ?? ""}`}>
      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="space-y-5">

        {/* ── Bloque 1: Datos del ítem ── */}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Fila 1: Fecha + Lote */}
          <Field label="Fecha de compra" error={errors.purchaseDate?.message}>
            <DateField control={control} name="purchaseDate" invalid={!!errors.purchaseDate} />
          </Field>
          <Field label="Lote" error={errors.lot?.message}>
            <input className="input" {...register("lot")} />
          </Field>

          {/* Fila 2: Código — media columna */}
          <Field label="Código" error={errors.code?.message} warn={codeWarn}>
            {(() => {
              const { onBlur: rhfBlur, onChange: rhfChange, ...codeReg } = register("code");
              return (
                <input
                    className="input"
                    {...codeReg}
                    onChange={(e) => { rhfChange(e); setCodeWarn(null); }}
                    onBlur={(e) => {
                      rhfBlur(e);
                      const val = e.target.value.trim().toUpperCase();
                      const isDuplicate = purchases.some(
                        (p) => p.code.toUpperCase() === val && p.id !== purchase?.id
                      );
                      if (val && isDuplicate) {
                        setCodeWarn(`El código "${val}" ya está en uso por otra compra.`);
                        toast.warning(`"${val}" ya está registrado en el inventario.`);
                      } else {
                        setCodeWarn(null);
                      }
                    }}
                />
              );
            })()}
          </Field>

          {/* Fila 3: Nombre — ancho completo */}
          <div className="sm:col-span-2">
            <Field label="Nombre del producto" error={errors.productName?.message}>
              <input className="input" {...register("productName")} />
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

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" size="sm" onClick={onClose} type="button">Cancelar</Button>
          <Button type="submit" size="sm" loading={isLoading}>Guardar cambios</Button>
        </div>
      </form>
    </Modal>
  );
}
