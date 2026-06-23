// API de Gyro Logistics.
import { baseApi } from "./baseApi";

export type ShipmentStatus =
  | "compra_registrada"
  | "entregado_china"
  | "recibido_china"
  | "recibido_nicaragua";

export interface ShipmentHistory {
  status: ShipmentStatus;
  comment: string;
  timestamp: string;
  by?: string;
}

export interface Shipment {
  id: string;
  customerEmail: string;
  customerName: string;
  trackingNumber: string;
  providerName: string;
  providerPhoneCode?: string;
  providerPhone: string;
  purchaseDate: string;
  photoUrl: string;
  invoiceFileUrl: string;
  arrivalPhotoUrl?: string;
  shippingCost?: number | null;
  shippingCurrency?: "C$" | "USD" | null;
  estimatedArrivalFrom?: string | null;
  estimatedArrivalTo?: string | null;
  status: ShipmentStatus;
  history: ShipmentHistory[];
  createdAt: string | null;
}

export const logisticsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getShipments: build.query<Shipment[], void>({
      query: () => "/logistics/shipments",
      providesTags: ["Shipment"],
    }),
    createShipment: build.mutation<Shipment, FormData>({
      query: (body) => ({ url: "/logistics/shipments", method: "POST", body }),
      invalidatesTags: ["Shipment"],
    }),
    // Cliente (o admin): "Proveedor ya entregó" → entregado_china.
    deliverChina: build.mutation<{ id: string; status: ShipmentStatus }, { id: string; comment?: string }>({
      query: ({ id, comment }) => ({ url: `/logistics/shipments/${id}/deliver-china`, method: "PATCH", body: { comment } }),
      invalidatesTags: ["Shipment"],
    }),
    // Admin valida recepción en China (comentario obligatorio) → recibido_china.
    receiveChina: build.mutation<{ id: string; status: ShipmentStatus }, { id: string; comment: string }>({
      query: ({ id, comment }) => ({ url: `/logistics/shipments/${id}/receive-china`, method: "PATCH", body: { comment } }),
      invalidatesTags: ["Shipment"],
    }),
    // Admin confirma llegada a Nicaragua (foto + costo) → recibido_nicaragua.
    receiveNicaragua: build.mutation<{ id: string; status: ShipmentStatus }, { id: string; body: FormData }>({
      query: ({ id, body }) => ({ url: `/logistics/shipments/${id}/receive-nicaragua`, method: "PATCH", body }),
      invalidatesTags: ["Shipment"],
    }),
  }),
});

export const {
  useGetShipmentsQuery,
  useCreateShipmentMutation,
  useDeliverChinaMutation,
  useReceiveChinaMutation,
  useReceiveNicaraguaMutation,
} = logisticsApi;
