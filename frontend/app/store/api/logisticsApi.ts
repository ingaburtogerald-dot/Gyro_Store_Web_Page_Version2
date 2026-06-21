// API de Gyro Logistics.
import { baseApi } from "./baseApi";

export type ShipmentStatus = "compra_registrada" | "recibido_china" | "recibido_nicaragua";

export interface ShipmentHistory {
  status: ShipmentStatus;
  comment: string;
  timestamp: string;
}

export interface Shipment {
  id: string;
  customerEmail: string;
  customerName: string;
  trackingNumber: string;
  providerName: string;
  providerPhone: string;
  purchaseDate: string;
  photoUrl: string;
  invoiceFileUrl: string;
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
    advanceShipment: build.mutation<{ ok: boolean }, { id: string; comment: string }>({
      query: ({ id, comment }) => ({ url: `/logistics/shipments/${id}/advance`, method: "PATCH", body: { comment } }),
      invalidatesTags: ["Shipment"],
    }),
  }),
});

export const { useGetShipmentsQuery, useCreateShipmentMutation, useAdvanceShipmentMutation } = logisticsApi;
