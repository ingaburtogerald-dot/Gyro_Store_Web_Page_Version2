// Portal de Ventas en Cuotas — solo admin.
// Registra ventas a plazo y rastrea cada pago hasta saldar el saldo.
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, CreditCard, ChevronDown, ChevronUp } from "lucide-react";
import { RequireRole } from "~/components/admin/RequireRole";
import { Modal } from "~/components/ui/Modal";
import { Button } from "~/components/ui/Button";
import {
  useGetInstallmentsQuery,
  useAddInstallmentPaymentMutation,
  type Installment,
} from "~/store/api/installmentsApi";
import { installmentPaymentSchema, type InstallmentPaymentInput } from "~/lib/validators";
import { DateField } from "~/components/ui/DatePicker";
import { formatCordobas } from "~/lib/utils";

function ProgressBar({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  return (
    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-accent transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function PaymentModal({ installment, onClose }: { installment: Installment | null; onClose: () => void }) {
  const [addPayment, { isLoading }] = useAddInstallmentPaymentMutation();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InstallmentPaymentInput>({
    resolver: zodResolver(installmentPaymentSchema),
    defaultValues: { paymentDate: new Date().toISOString().split("T")[0], paymentMethod: "efectivo" },
  });

  async function onSubmit(data: InstallmentPaymentInput) {
    if (!installment) return;
    try {
      const res = await addPayment({ id: installment.id, body: data }).unwrap();
      toast.success(
        res.completed
          ? "Pago registrado. ¡Venta completamente pagada!"
          : `Pago registrado. Saldo pendiente: ${formatCordobas(res.amountPending)}`
      );
      reset();
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo registrar el pago.");
    }
  }

  return (
    <Modal open={!!installment} onClose={onClose} title={`Registrar pago · ${installment?.customerName ?? ""}`}>
      {installment && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted">Total</span>
              <span className="font-semibold">{formatCordobas(installment.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Pagado</span>
              <span className="text-emerald-400 font-semibold">{formatCordobas(installment.amountPaid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Pendiente</span>
              <span className="text-amber-400 font-bold">{formatCordobas(installment.amountPending)}</span>
            </div>
            <ProgressBar paid={installment.amountPaid} total={installment.totalAmount} />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Monto recibido (C$) *</span>
              <input type="number" step="1" min={1} className="input" {...register("amount")} />
              {errors.amount && <span className="mt-1 block text-xs text-red-400">{errors.amount.message}</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Fecha de pago *</span>
              <DateField control={control} name="paymentDate" invalid={!!errors.paymentDate} />
              {errors.paymentDate && <span className="mt-1 block text-xs text-red-400">{errors.paymentDate.message}</span>}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Próximo pago</span>
              <DateField control={control} name="nextPaymentDate" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Método de pago</span>
              <select className="input" {...register("paymentMethod")}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Notas</span>
              <input className="input" placeholder="Opcional..." {...register("notes")} />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
              <Button type="submit" loading={isLoading}>Registrar pago</Button>
            </div>
          </form>
        </div>
      )}
    </Modal>
  );
}

function InstallmentCard({ inst }: { inst: Installment }) {
  const [expanded, setExpanded] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const pct = inst.totalAmount > 0 ? Math.min(100, Math.round((inst.amountPaid / inst.totalAmount) * 100)) : 0;

  return (
    <div className="rounded-card border border-border bg-surface overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-text">{inst.customerName}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                inst.status === "completed"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-amber-500/15 text-amber-400"
              }`}>
                {inst.status === "completed" ? "Pagado" : "Activo"}
              </span>
            </div>
            <p className="text-xs text-muted">{inst.customerPhone}</p>
            {inst.sellerName && <p className="text-xs text-muted">Vendedor: {inst.sellerName}</p>}
          </div>
          <div className="text-right text-sm">
            <p className="font-bold text-text">{formatCordobas(inst.totalAmount)}</p>
            <p className="text-xs text-muted">{inst.numInstallments} cuotas</p>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted">
            <span>{pct}% pagado</span>
            <span>Pendiente: {formatCordobas(inst.amountPending)}</span>
          </div>
          <ProgressBar paid={inst.amountPaid} total={inst.totalAmount} />
        </div>

        {inst.nextPaymentDate && inst.status === "active" && (
          <p className="text-xs text-amber-400">
            Próximo pago: {new Date(inst.nextPaymentDate + "T00:00:00").toLocaleDateString("es-NI")}
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          {inst.status === "active" && (
            <Button size="sm" onClick={() => setPaymentOpen(true)} className="flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              Registrar pago
            </Button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-auto flex items-center gap-1 text-xs text-muted hover:text-text transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {inst.payments.length} {inst.payments.length === 1 ? "pago" : "pagos"}
          </button>
        </div>
      </div>

      {expanded && inst.payments.length > 0 && (
        <div className="border-t border-border divide-y divide-border">
          {inst.payments.map((p, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
              <div>
                <span className="font-medium text-text">{formatCordobas(p.amount)}</span>
                <span className="ml-2 text-xs text-muted capitalize">{p.paymentMethod || "efectivo"}</span>
              </div>
              <span className="text-xs text-muted">
                {new Date(p.paymentDate + "T00:00:00").toLocaleDateString("es-NI")}
              </span>
            </div>
          ))}
        </div>
      )}

      <PaymentModal installment={paymentOpen ? inst : null} onClose={() => setPaymentOpen(false)} />
    </div>
  );
}

export default function Cuotas() {
  const { data: installments = [], isLoading } = useGetInstallmentsQuery();
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");

  const filtered = installments.filter((i) => {
    if (filter === "active") return i.status === "active";
    if (filter === "completed") return i.status === "completed";
    return true;
  });

  const activeCount = installments.filter((i) => i.status === "active").length;

  return (
    <RequireRole allowed={["admin"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text">Ventas en Cuotas</h1>
            <p className="text-sm text-muted mt-0.5">
              Seguimiento de pagos hasta saldar el saldo total
            </p>
          </div>
          {activeCount > 0 && (
            <div className="flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1.5 text-sm font-medium text-amber-400">
              <CreditCard className="h-4 w-4" />
              {activeCount} activas
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {(["active", "all", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-gradient-accent text-white"
                  : "bg-surface-2 text-muted hover:text-text"
              }`}
            >
              {f === "all" ? "Todas" : f === "active" ? "Activas" : "Completadas"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-card bg-surface" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <CreditCard className="h-10 w-10 text-muted opacity-40" />
            <p className="text-muted">No hay ventas en cuotas en esta categoría.</p>
            <p className="text-xs text-muted">
              Las ventas en cuotas se registran desde el portal de ventas.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((inst) => (
              <InstallmentCard key={inst.id} inst={inst} />
            ))}
          </div>
        )}
      </div>
    </RequireRole>
  );
}
