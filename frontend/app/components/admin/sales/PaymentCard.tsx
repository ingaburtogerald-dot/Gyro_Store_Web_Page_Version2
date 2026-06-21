// Tarjeta de un pago recibido por el vendedor (historial de pagos). Da transparencia:
// cuánto, cuándo, método y comprobante.
import { Calendar, Banknote, Landmark, ImageIcon } from "lucide-react";
import { formatCordobas } from "~/lib/utils";
import type { MySellerPayment } from "~/store/api/salesApi";

export function PaymentCard({ payment }: { payment: MySellerPayment }) {
  const date = payment.createdAt
    ? new Date(payment.createdAt).toLocaleDateString("es-NI", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  const isCash = payment.paymentMethod === "cash";

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <Calendar className="h-3.5 w-3.5" /> {date}
        </span>
        <span className="flex items-center gap-1.5 rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted">
          {isCash ? <Banknote className="h-3.5 w-3.5" /> : <Landmark className="h-3.5 w-3.5" />}
          {isCash ? "Efectivo" : "Depósito"}
        </span>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <span className="block text-xs text-muted">
            {payment.isSettlement ? "Saldo saldado" : `Pago de ${payment.ventasCount} venta${payment.ventasCount === 1 ? "" : "s"}`}
          </span>
          {payment.saldoAplicado !== 0 && (
            <span className="text-xs text-amber-300">Saldo aplicado: {formatCordobas(payment.saldoAplicado)}</span>
          )}
        </div>
        <span className="text-xl font-bold text-whatsapp">{formatCordobas(payment.totalComision)}</span>
      </div>

      {payment.receiptUrl ? (
        <a
          href={payment.receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-accent-2 hover:underline"
        >
          <ImageIcon className="h-3.5 w-3.5" /> Ver comprobante
        </a>
      ) : payment.noReceiptComment ? (
        <p className="text-xs italic text-muted">Nota: {payment.noReceiptComment}</p>
      ) : null}
    </div>
  );
}
