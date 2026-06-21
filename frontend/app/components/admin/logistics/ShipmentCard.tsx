// Tarjeta de paquete con timeline de estado. En modo admin muestra el botón
// para avanzar al siguiente estado.
import { CheckCircle2, Circle, Image, FileText, ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/Button";
import type { Shipment } from "~/store/api/logisticsApi";
import { SHIPMENT_FLOW, SHIPMENT_LABEL } from "./shipmentMeta";

export function ShipmentCard({
  shipment,
  isAdmin,
  onAdvance,
}: {
  shipment: Shipment;
  isAdmin?: boolean;
  onAdvance?: (s: Shipment) => void;
}) {
  const currentIdx = SHIPMENT_FLOW.indexOf(shipment.status);
  const isFinal = currentIdx === SHIPMENT_FLOW.length - 1;

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">Tracking: {shipment.trackingNumber}</p>
          <p className="text-xs text-muted">
            {isAdmin ? `${shipment.customerName} · ` : ""}
            {shipment.providerName || "Proveedor —"} · {shipment.purchaseDate || "—"}
          </p>
        </div>
        <div className="flex gap-2">
          {shipment.photoUrl && (
            <a href={shipment.photoUrl} target="_blank" rel="noreferrer" className="text-muted hover:text-text" aria-label="Foto">
              <Image className="h-4 w-4" />
            </a>
          )}
          {shipment.invoiceFileUrl && (
            <a href={shipment.invoiceFileUrl} target="_blank" rel="noreferrer" className="text-muted hover:text-text" aria-label="Factura">
              <FileText className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* Timeline */}
      <ol className="mt-4 space-y-2">
        {SHIPMENT_FLOW.map((status, i) => {
          const done = i <= currentIdx;
          const entry = shipment.history?.find((h) => h.status === status);
          return (
            <li key={status} className="flex items-start gap-2 text-sm">
              {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-whatsapp" /> : <Circle className="mt-0.5 h-4 w-4 text-muted" />}
              <div>
                <p className={done ? "" : "text-muted"}>{SHIPMENT_LABEL[status]}</p>
                {entry?.comment && <p className="text-xs text-muted">{entry.comment}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      {isAdmin && !isFinal && (
        <Button size="sm" className="mt-4" onClick={() => onAdvance?.(shipment)}>
          Avanzar estado <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
