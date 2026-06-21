// Banner de saldos pendientes por vendedor (ajustes por ediciones de ventas pagadas).
//   balance > 0 → saldo A FAVOR del vendedor (la tienda le debe).
//   balance < 0 → saldo EN CONTRA (recibió de más; se descontará del próximo pago).
// Permite saldar el saldo aparte (con comprobante) sin esperar al próximo corte.
import { useState } from "react";
import { Wallet, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/Button";
import { Modal } from "~/components/ui/Modal";
import { useSettleBalanceMutation, type SellerBalance } from "~/store/api/salesApi";
import { formatCordobas, cn } from "~/lib/utils";

export function SellerBalances({ balances }: { balances: SellerBalance[] }) {
  const [settleFor, setSettleFor] = useState<SellerBalance | null>(null);

  if (!balances.length) return null;

  return (
    <div className="rounded-card border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Wallet className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-bold text-amber-300">Saldos pendientes por ajustes de ventas</h3>
      </div>
      <p className="mb-3 text-xs text-muted">
        Estas ventas pagadas fueron editadas después del pago. La diferencia se aplicará automáticamente en el
        próximo pago del vendedor, o puedes saldarla ahora.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {balances.map((b) => {
          const favor = b.balance > 0;
          return (
            <div key={b.sellerEmail} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">{b.sellerName}</p>
                <p className={cn("flex items-center gap-1 text-sm font-bold", favor ? "text-emerald-400" : "text-rose-400")}>
                  {favor ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {favor ? "A favor" : "En contra"}: {formatCordobas(Math.abs(b.balance))}
                </p>
                <p className="text-[11px] text-muted">{b.count} ajuste(s)</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setSettleFor(b)}>
                Saldar
              </Button>
            </div>
          );
        })}
      </div>

      {settleFor && (
        <SettleBalanceModal balance={settleFor} onClose={() => setSettleFor(null)} />
      )}
    </div>
  );
}

function SettleBalanceModal({ balance, onClose }: { balance: SellerBalance; onClose: () => void }) {
  const [settle, { isLoading }] = useSettleBalanceMutation();
  const [method, setMethod] = useState<"cash" | "deposit">("cash");
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");

  const favor = balance.balance > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file && !comment.trim()) {
      return toast.error("Adjunta un comprobante o justifica su ausencia.");
    }
    try {
      const fd = new FormData();
      fd.append("sellerEmail", balance.sellerEmail);
      fd.append("paymentMethod", method);
      if (file) fd.append("receipt", file);
      if (comment.trim()) fd.append("noReceiptComment", comment.trim());

      const res = await settle(fd).unwrap();
      toast.success("Saldo saldado correctamente.");
      if (res.whatsappUrl) window.open(res.whatsappUrl, "_blank");
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.error || "No se pudo saldar el saldo.");
    }
  }

  return (
    <Modal open onClose={onClose} title="Saldar saldo pendiente">
      <form onSubmit={submit} className="space-y-4">
        <div className={cn("rounded-xl border p-4 text-sm", favor ? "border-emerald-500/30 bg-emerald-500/10" : "border-rose-500/30 bg-rose-500/10")}>
          <p className="text-muted">Vendedor: <strong className="text-text">{balance.sellerName}</strong></p>
          <p className="mt-1 font-semibold">
            {favor
              ? <>La tienda le debe <span className="text-emerald-400">{formatCordobas(balance.balance)}</span>. Al saldar, se registra el pago de ese monto.</>
              : <>El vendedor debe <span className="text-rose-400">{formatCordobas(Math.abs(balance.balance))}</span>. Al saldar, se registra que devolvió ese monto.</>}
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Método</label>
          <div className="grid grid-cols-2 gap-2">
            {(["cash", "deposit"] as const).map((m) => (
              <label key={m} className={cn(
                "flex cursor-pointer items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors",
                method === m ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface hover:bg-surface-2 text-muted",
              )}>
                <input type="radio" name="settle-method" value={m} className="hidden" checked={method === m} onChange={() => setMethod(m)} />
                {m === "cash" ? "💵 Efectivo" : "🏦 Depósito"}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Comprobante (opcional si justificas)</label>
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2 p-6 text-sm text-muted hover:border-accent hover:text-accent transition-colors">
            {file ? file.name : "Sube la foto del comprobante"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>

        {!file && (
          <div className="animate-fade-in">
            <label className="mb-1.5 block text-xs font-semibold text-rose-400">Motivo por no subir comprobante (obligatorio)</label>
            <textarea
              className="input w-full"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ej: Se ajustó en efectivo, sin comprobante por el momento…"
              required={!file}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={isLoading} className="bg-emerald-500/90 hover:bg-emerald-500">Saldar</Button>
        </div>
      </form>
    </Modal>
  );
}
