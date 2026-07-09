// Tarjeta de venta para los paneles del admin en móvil (reemplaza la tabla ancha).
// Sirve tanto a AdminSalesHistory (campos display*) como a PendingSales (campos total*)
// gracias a los fallbacks.
import { Calendar } from "lucide-react";
import { SALE_STATUS_META } from "./saleStatus";
import { StatusBadge } from "~/components/ui/StatusBadge";
import { Card } from "~/components/ui/Card";
import { formatCordobas, cn } from "~/lib/utils";
import type { Sale } from "~/store/api/salesApi";
import { groupSaleItems, totalQuantity } from "~/domain/sales/salesCalculations";

export function AdminSaleCard({ sale }: { sale: any }) {
  const meta = SALE_STATUS_META[sale.status as Sale["status"]];
  const date = sale.createdAt ? new Date(sale.createdAt).toLocaleDateString("es-NI") : "—";
  const items = sale.items || [];
  const qty = totalQuantity(items);
  const grouped = groupSaleItems(items);

  const costReal = sale.displayCostReal ?? sale.totalCostReal ?? 0;
  const utilNeta = sale.displayUtilidadNeta ?? sale.totalUtilidadNeta ?? 0;
  const comision = sale.displayComisionVendedor ?? sale.comisionVendedor ?? 0;
  const ganancia = sale.displayGananciaTienda ?? sale.gananciaTienda ?? 0;
  const invRecuperada = (sale.saleTotal || 0) - costReal;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Calendar className="h-3.5 w-3.5" /> {date}
          </span>
          <p className="truncate font-semibold text-text">{sale.sellerName}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={meta.status} label={meta.label} />
          {sale.editReason && (
            <span className="rounded-pill bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-accent-2">Editada</span>
          )}
        </div>
      </div>

      <p className="truncate text-xs text-muted" title={grouped.map((i: any) => i.name).join(", ")}>
        {qty} u · {grouped.map((i: any) => i.name).join(", ")}
      </p>
      {grouped.some((i: any) => i.code) && (
        <p
          className="truncate font-mono text-[11px] text-muted/80"
          title={grouped.map((i: any) => i.code).filter(Boolean).join(", ")}
        >
          {grouped.map((i: any) => i.code).filter(Boolean).join(", ")}
        </p>
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3">
        <Metric label="Precio venta" value={formatCordobas(sale.saleTotal)} className="font-semibold text-text" />
        <Metric label="Costo real" value={formatCordobas(costReal)} className="text-muted" />
        <Metric label="Inv. recuperada" value={formatCordobas(invRecuperada)} className="text-accent-2" />
        <Metric label="Utilidad neta" value={formatCordobas(utilNeta)} className="text-text" />
        <Metric
          label="Comisión"
          value={`${formatCordobas(comision)}${sale.comisionPercent !== undefined ? ` (${sale.comisionPercent}%)` : ""}`}
          className="text-accent-2"
        />
      </div>

      {/* Ancla: la ganancia de la tienda es la estrella (Sora, tabular-nums). */}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Ganancia tienda</span>
        <span className="font-heading text-lg font-bold tabular-nums text-whatsapp">{formatCordobas(ganancia)}</span>
      </div>
    </Card>
  );
}

function Metric({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <span className="block text-[10px] uppercase tracking-wide text-muted">{label}</span>
      <span className={cn("text-xs tabular-nums", className ?? "text-text")}>{value}</span>
    </div>
  );
}
