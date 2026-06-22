// Detalle de una venta para el vendedor (al tocar una card en "Mis Ventas").
// Muestra el desglose de productos, las fechas del ciclo y el recibo. Solo datos
// permitidos al vendedor (total + su comisión; nada de costos/utilidad).
import { ImageIcon, AlertCircle } from "lucide-react";
import { Modal } from "~/components/ui/Modal";
import { SALE_STATUS_META } from "./saleStatus";
import { formatCordobas } from "~/lib/utils";
import type { Sale } from "~/store/api/salesApi";

export function SaleDetailModal({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  if (!sale) return null;
  const meta = SALE_STATUS_META[sale.status];
  const fmt = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString("es-NI", { day: "2-digit", month: "short", year: "numeric" }) : null;

  const createdAt = fmt(sale.createdAt);
  const approvedAt = fmt((sale as any).approvedAt);
  const paidAt = fmt((sale as any).paidAt);

  return (
    <Modal open={!!sale} onClose={onClose} title="Detalle de venta" maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
          <div className="text-right">
            <span className="block text-xs text-muted">Mi comisión</span>
            <span className="text-lg font-bold text-whatsapp">
              {sale.comisionVendedor ? formatCordobas(sale.comisionVendedor) : "—"}
            </span>
          </div>
        </div>

        {/* Productos */}
        <div className="divide-y divide-border rounded-lg border border-border">
          {sale.items?.map((it, i) => (
            <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-mono text-xs text-muted">{it.quantity}× </span>
                {it.name}
              </span>
              <span className="shrink-0 text-muted">{formatCordobas(it.lineTotal ?? it.salePrice * it.quantity)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-3 py-2 text-sm font-bold">
            <span>Total venta</span>
            <span>{formatCordobas(sale.saleTotal)}</span>
          </div>
        </div>

        {/* Línea de tiempo */}
        <div className="space-y-1 text-sm">
          {createdAt && <DateRow label="Registrada" value={createdAt} />}
          {approvedAt && <DateRow label="Aprobada" value={approvedAt} />}
          {paidAt && <DateRow label="Pagada" value={paidAt} />}
        </div>

        {sale.status === "rejected" && sale.rejectionReason && (
          <div className="flex items-start gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <strong>Motivo del rechazo:</strong> {sale.rejectionReason}
            </span>
          </div>
        )}

        {sale.receiptPhotoUrl && (
          <a
            href={sale.receiptPhotoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-accent-2 hover:underline"
          >
            <ImageIcon className="h-4 w-4" /> Ver recibo
          </a>
        )}
      </div>
    </Modal>
  );
}

function DateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-text">{value}</span>
    </div>
  );
}
