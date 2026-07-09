// Modal "Aprobar y Pagar" (lote de un solo vendedor). Extraído del God component.
// La matemática del pago vive en domain/computePayout; la mutación + toasts + modal de
// éxito los maneja el hook (vía `onSubmit`). Aquí solo: formulario + validación de UI.
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { DatePicker } from "~/components/ui/DatePicker";
import { useGetBalancesQuery, type Sale } from "~/store/api/salesApi";
import { computePayout } from "~/domain/sales/salesCalculations";
import { formatCordobas } from "~/lib/utils";
import type { ApprovePaySuccess } from "~/hooks/sales/useAdminSaleActions";

interface Props {
  sales: Sale[];
  onClose: () => void;
  /** Provisto por el hook: arma la mutación, toast y abre el modal de éxito. */
  onSubmit: (fd: FormData) => Promise<ApprovePaySuccess | undefined>;
}

export function ApproveAndPayModal({ sales, onClose, onSubmit }: Props) {
  const [method, setMethod] = useState<"cash" | "deposit">("cash");
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  const { data: balances = {} } = useGetBalancesQuery();
  const saldo = balances[sales[0]?.sellerEmail]?.balance ?? 0;
  const { totalComision, totalAPagar } = computePayout(sales, saldo); // ← dominio
  const sellerName = sales[0].sellerName;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file && !comment.trim()) {
      toast.error("Debes adjuntar el comprobante o ingresar un motivo de por qué no lo subes.");
      return;
    }
    setLoading(true);
    const fd = new FormData();
    fd.append("saleIds", JSON.stringify(sales.map((s) => s.id)));
    fd.append("paymentMethod", method);
    if (file) fd.append("receipt", file);
    if (comment.trim()) fd.append("noReceiptComment", comment.trim());
    if (paymentDate) fd.append("paymentDate", paymentDate);
    await onSubmit(fd);
    setLoading(false);
  }

  return (
    <Modal open onClose={onClose} title="Revisión y Pago de Ventas">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 text-sm text-muted">
            Vendedor: <strong className="text-text">{sellerName}</strong>
            <br />
            Ventas a aprobar: <strong className="text-text">{sales.length}</strong>
          </div>

          <div className="space-y-1.5 rounded-lg border border-border/50 bg-bg/50 p-3">
            {saldo !== 0 && (
              <>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Comisión de ventas:</span>
                  <span>{formatCordobas(totalComision)}</span>
                </div>
                <div className={`flex items-center justify-between text-xs font-medium ${saldo > 0 ? "text-accent-2" : "text-danger"}`}>
                  <span>Saldo {saldo > 0 ? "a favor" : "en contra"} (ajustes):</span>
                  <span>{saldo > 0 ? "+" : "−"}{formatCordobas(Math.abs(saldo))}</span>
                </div>
                <div className="my-1 border-t border-border/50" />
              </>
            )}
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Total a Pagar:</span>
              <span className="text-lg text-accent-2">{formatCordobas(saldo !== 0 ? totalAPagar : totalComision)}</span>
            </div>
            {saldo < 0 && totalAPagar === 0 && (
              <p className="pt-1 text-[11px] text-danger">
                El saldo en contra supera la comisión: se descontará lo posible y el resto queda pendiente para el próximo pago.
              </p>
            )}
          </div>
        </div>

        <Field label="Fecha de Pago">
          <DatePicker value={paymentDate} onChange={setPaymentDate} placeholder="Selecciona la fecha de pago" />
        </Field>

        <Field label="Método de Pago">
          <div className="grid grid-cols-2 gap-2">
            <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors ${method === "cash" ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:bg-surface-2"}`}>
              <input type="radio" name="method" value="cash" className="hidden" checked={method === "cash"} onChange={() => setMethod("cash")} />
              💵 Efectivo (Factura)
            </label>
            <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors ${method === "deposit" ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-muted hover:bg-surface-2"}`}>
              <input type="radio" name="method" value="deposit" className="hidden" checked={method === "deposit"} onChange={() => setMethod("deposit")} />
              🏦 Depósito (Screenshot)
            </label>
          </div>
        </Field>

        <Field label="Comprobante (Opcional si justificas)">
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2 p-6 text-sm text-muted transition-colors hover:border-accent hover:text-accent">
            {file ? file.name : method === "cash" ? "Sube la foto de la factura" : "Sube el screenshot del depósito"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </Field>

        {!file && (
          <div className="animate-fade-in">
            <Field label="Motivo por no subir comprobante (Obligatorio)">
              <textarea
                className="input w-full"
                rows={2}
                placeholder="Ej: Pago realizado previamente, venta migrada..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                required
              />
            </Field>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Aprobar y Pagar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
