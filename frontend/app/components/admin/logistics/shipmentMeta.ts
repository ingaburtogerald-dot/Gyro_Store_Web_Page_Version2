// Estados del paquete y su orden en el timeline.
import type { ShipmentStatus } from "~/store/api/logisticsApi";

export const SHIPMENT_FLOW: ShipmentStatus[] = [
  "compra_registrada",
  "entregado_china",
  "recibido_china",
  "recibido_nicaragua",
];

export const SHIPMENT_LABEL: Record<ShipmentStatus, string> = {
  compra_registrada: "Compra registrada",
  entregado_china: "Proveedor entregó en China",
  recibido_china: "Recibido en China",
  recibido_nicaragua: "Recibido en Nicaragua",
};
