// Tarjeta de paquete con timeline de estado. Muestra los botones de acción según el
// rol (cliente vs admin) y el estado actual del paquete.
import { CheckCircle2, Circle, Image, FileText, ArrowRight, PackageCheck, Truck } from "lucide-react";
import { Button } from "~/components/ui/Button";
import type { Shipment } from "~/store/api/logisticsApi";
import { SHIPMENT_FLOW, SHIPMENT_LABEL } from "./shipmentMeta";

export function ShipmentCard({
  shipment,
  isAdmin,
  onDeliverChina,
  onReceiveChina,
  onReceiveNicaragua,
}: {
  shipment: Shipment;
  isAdmin?: boolean;
  onDeliverChina?: (s: Shipment) => void;
  onReceiveChina?: (s: Shipment) => void;
  onReceiveNicaragua?: (s: Shipment) => void;
}) {
  const currentIdx = SHIPMENT_FLOW.indexOf(shipment.status);
  const sym = shipment.shippingCurrency === "USD" ? "$" : "C$";
  const phone = shipment.providerPhone
    ? `${shipment.providerPhoneCode || ""} ${shipment.providerPhone}`.trim()
    : "";

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">Tracking: {shipment.trackingNumber}</p>
          <p className="text-xs text-muted">
            {isAdmin ? `${shipment.customerName} · ` : ""}
            {shipment.providerName || "Proveedor —"}
            {phone ? ` · ${phone}` : ""} · {shipment.purchaseDate || "—"}
          </p>
        </div>
        <div className="flex gap-2">
          {shipment.photoUrl && (
            <a href={shipment.photoUrl} target="_blank" rel="noreferrer" className="text-muted hover:text-text" aria-label="Foto del paquete" title="Foto del paquete">
              <Image className="h-4 w-4" />
            </a>
          )}
          {shipment.invoiceFileUrl && (
            <a href={shipment.invoiceFileUrl} target="_blank" rel="noreferrer" className="text-muted hover:text-text" aria-label="Factura" title="Factura">
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
                {status === "recibido_china" && done && shipment.estimatedArrivalFrom && (
                  <p className="text-xs text-accent-2">
                    Llegada estimada: entre {shipment.estimatedArrivalFrom} y {shipment.estimatedArrivalTo}
                  </p>
                )}
                {status === "recibido_nicaragua" && done && (
                  <div className="text-xs text-muted">
                    {Number(shipment.shippingCost) > 0 && (
                      <span className="font-medium text-text">Costo de envío: {sym}{shipment.shippingCost}</span>
                    )}
                    {shipment.arrivalPhotoUrl && (
                      <a href={shipment.arrivalPhotoUrl} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-accent-2 hover:underline">
                        <Image className="h-3 w-3" /> foto
                      </a>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Acciones */}
      <div className="mt-4 flex flex-wrap gap-2">
        {/* Cliente o admin: el proveedor entregó en China */}
        {shipment.status === "compra_registrada" && (
          <Button size="sm" variant={isAdmin ? "outline" : "primary"} onClick={() => onDeliverChina?.(shipment)}>
            <PackageCheck className="h-4 w-4" /> Proveedor ya entregó
          </Button>
        )}

        {isAdmin && (shipment.status === "compra_registrada" || shipment.status === "entregado_china") && (
          <Button size="sm" onClick={() => onReceiveChina?.(shipment)}>
            Recibido en China <ArrowRight className="h-4 w-4" />
          </Button>
        )}

        {isAdmin && shipment.status === "recibido_china" && (
          <Button size="sm" onClick={() => onReceiveNicaragua?.(shipment)}>
            <Truck className="h-4 w-4" /> Recibido en Nicaragua
          </Button>
        )}
      </div>
    </div>
  );
}
