// API de órdenes públicas (checkout por WhatsApp) y contacto.
import { baseApi } from "./baseApi";

export interface PublicOrderItem {
  catalogId: string;
  /** Presente cuando la línea es un combo; el servidor revalida su precio. */
  comboId?: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
}

export interface PublicOrderPayload {
  customerName: string;
  customerPhone: string;
  deliveryMethod: "retiro" | "envio";
  address?: string;
  /** Link de Google Maps con el pin GPS del cliente (opcional). */
  locationUrl?: string;
  note?: string;
  /** Incentivo por reseña — se revalida y descuenta un uso en el servidor. */
  discountCode?: string;
  items: PublicOrderItem[];
}

export interface PublicOrderResult {
  id: string;
  subtotal: number;
  discount: number;
  codeDiscount: number;
  total: number;
  whatsappUrl: string;
}

export interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  message: string;
}

export const ordersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    createPublicOrder: build.mutation<PublicOrderResult, PublicOrderPayload>({
      query: (body) => ({ url: "/orders/public", method: "POST", body }),
    }),
    sendContact: build.mutation<{ ok: boolean }, ContactPayload>({
      query: (body) => ({ url: "/contact", method: "POST", body }),
    }),
  }),
});

export const { useCreatePublicOrderMutation, useSendContactMutation } = ordersApi;
