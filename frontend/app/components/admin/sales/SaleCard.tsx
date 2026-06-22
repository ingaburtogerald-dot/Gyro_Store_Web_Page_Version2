// Tarjeta de una venta para el portal del vendedor. Reemplaza la tabla ancha por una
// vista apilada que se lee bien en móvil y en desktop (en grilla). Solo muestra datos
// permitidos al vendedor: productos, total y SU comisión (nunca costos/utilidad/ganancia).
import { Calendar, AlertCircle, ImageIcon } from "lucide-react";
import { SALE_STATUS_META } from "./saleStatus";
import { formatCordobas } from "~/lib/utils";
import type { Sale } from "~/store/api/salesApi";

export function SaleCard({ sale, onClick }: { sale: Sale; onClick?: () => void }) {
  const meta = SALE_STATUS_META[sale.status];
  const date = sale.createdAt
    ? new Date(sale.createdAt).toLocaleDateString("es-NI", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

  return (
    <div
      onClick={onClick}
      className={`flex min-w-0 flex-col gap-3 overflow-hidden rounded-card border border-border bg-surface p-4 transition-colors hover:border-accent-2/40${onClick ? " cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <Calendar className="h-3.5 w-3.5" /> {date}
        </span>
        <span className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
      </div>

      <div className="space-y-1.5">
        {sale.items?.map((it, idx) => (
          <div key={idx} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted">{it.quantity}×</span>
              <span className="min-w-0 flex-1 truncate">{it.name}</span>
            </span>
            <span className="shrink-0 text-muted">{formatCordobas(it.lineTotal ?? it.salePrice * it.quantity)}</span>
          </div>
        ))}
      </div>

      {sale.status === "rejected" && sale.rejectionReason && (
        <div className="flex items-start gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Motivo del rechazo:</strong> {sale.rejectionReason}
          </span>
        </div>
      )}

      <div className="flex items-end justify-between border-t border-border pt-3">
        <div>
          <span className="block text-xs text-muted">Total venta</span>
          <span className="font-bold text-text">{formatCordobas(sale.saleTotal)}</span>
        </div>
        <div className="text-right">
          <span className="block text-xs text-muted">Mi comisión</span>
          <span className="text-lg font-bold text-whatsapp">
            {sale.comisionVendedor ? formatCordobas(sale.comisionVendedor) : "—"}
          </span>
        </div>
      </div>

      {sale.receiptPhotoUrl && (
        <a
          href={sale.receiptPhotoUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-xs text-accent-2 hover:underline"
        >
          <ImageIcon className="h-3.5 w-3.5" /> Ver recibo
        </a>
      )}
    </div>
  );
}
