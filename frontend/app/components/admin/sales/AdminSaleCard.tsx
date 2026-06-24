// Tarjeta de venta para los paneles del admin en móvil (reemplaza la tabla ancha).
// Sirve tanto a AdminSalesHistory (campos display*) como a PendingSales (campos total*)
// gracias a los fallbacks.
import { Calendar } from "lucide-react";
import { SALE_STATUS_META } from "./saleStatus";
import { formatCordobas } from "~/lib/utils";
import type { Sale } from "~/store/api/salesApi";

export function AdminSaleCard({ sale }: { sale: any }) {
  const meta = SALE_STATUS_META[sale.status as Sale["status"]];
  const date = sale.createdAt ? new Date(sale.createdAt).toLocaleDateString("es-NI") : "—";
  const items = sale.items || [];
  const qty = items.reduce((s: number, i: any) => s + (i.quantity || 0), 0);

  const costReal = sale.displayCostReal ?? sale.totalCostReal ?? 0;
  const utilNeta = sale.displayUtilidadNeta ?? sale.totalUtilidadNeta ?? 0;
  const comision = sale.displayComisionVendedor ?? sale.comisionVendedor ?? 0;
  const ganancia = sale.displayGananciaTienda ?? sale.gananciaTienda ?? 0;
  const invRecuperada = (sale.saleTotal || 0) - costReal;

  return (
    <div className="space-y-3 rounded-card border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Calendar className="h-3.5 w-3.5" /> {date}
          </span>
          <p className="truncate font-semibold text-text">{sale.sellerName}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
          {sale.editReason && (
            <span className="rounded-pill bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-accent-2">Editada</span>
          )}
        </div>
      </div>

      <p className="truncate text-xs text-muted" title={items.map((i: any) => i.name).join(", ")}>
        {qty} u · {items.map((i: any) => i.name).join(", ")}
      </p>
      {items.some((i: any) => i.code) && (
        <p
          className="truncate font-mono text-[11px] text-muted/80"
          title={items.map((i: any) => i.code).filter(Boolean).join(", ")}
        >
          {items.map((i: any) => i.code).filter(Boolean).join(", ")}
        </p>
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3">
        <Metric label="Precio venta" value={formatCordobas(sale.saleTotal)} className="font-semibold text-text" />
        <Metric label="Costo real" value={formatCordobas(costReal)} className="text-muted" />
        <Metric label="Inv. recuperada" value={formatCordobas(invRecuperada)} className="text-emerald-400" />
        <Metric label="Utilidad neta" value={formatCordobas(utilNeta)} className="text-text" />
        <Metric
          label="Comisión"
          value={`${formatCordobas(comision)}${sale.comisionPercent !== undefined ? ` (${sale.comisionPercent}%)` : ""}`}
          className="text-emerald-400"
        />
        <Metric label="Ganancia" value={formatCordobas(ganancia)} className="font-bold text-whatsapp" />
      </div>
    </div>
  );
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <span className="block text-[10px] uppercase text-muted">{label}</span>
      <span className={`font-mono text-xs ${className ?? "text-text"}`}>{value}</span>
    </div>
  );
}
