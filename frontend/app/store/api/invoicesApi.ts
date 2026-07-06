// API del portal de Facturación. El ticket reserva stock FIFO al crearse;
// el vendedor registra su venta desde él (hereda reservas). deliveryFee es
// solo informativo (se imprime, no entra al total ni a comisiones).
import { baseApi } from "./baseApi";

export type ProductOrigin = "native" | "migrated";

export interface InvoiceItem {
  productId?: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  origin?: ProductOrigin;
  migratedId?: string; // solo migrado
  unitCostReal?: number; // solo migrado (para comisión/consumo aguas abajo)
}

export type InvoiceStatus = "unlinked" | "linked" | "void" | "paid";

export interface InvoiceCustomer {
  firstName: string;
  lastName: string;
  phone: string;
}

export interface TicketSeller {
  uid: string;
  email: string;
  name: string;
}

export interface Invoice {
  id: string;
  ticketNumber: string;
  status: InvoiceStatus;
  customer?: InvoiceCustomer | null;
  contactId?: string | null;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  deliveryFee?: number;
  paymentMethod: string;
  assignedSeller?: TicketSeller | null;
  createdBy?: TicketSeller | null; // cajera que emitió el ticket
  sellerName: string; // legacy: tickets pre-reforma
  linkedToOrder: string | null;
  linkedOrderIds?: string[];
  voidInfo?: { reason: string; at: string | null; by: string } | null;
  createdAt: string | null;
  updatedAt?: string | null;
  linkedAt?: string | null;
}

export interface NewInvoice {
  customer: InvoiceCustomer;
  items: {
    productCode: string;
    quantity: number;
    unitPrice: number;
    origin?: ProductOrigin;
    productId?: string;
  }[];
  discount: number;
  deliveryFee: number;
  paymentMethod: string;
  assignedSeller: TicketSeller;
  contactId?: string | null;
}

export interface ProductLookup {
  productId: string;
  code: string;
  name: string;
  price: number;
  stock: number;
  origin: ProductOrigin;
}

export const invoicesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getInvoices: build.query<Invoice[], InvoiceStatus | void>({
      query: (status) => (status ? `/invoices?status=${status}` : "/invoices"),
      providesTags: ["Invoice"],
    }),
    lookupProduct: build.query<ProductLookup, string>({
      query: (code) => `/invoices/lookup?code=${encodeURIComponent(code)}`,
    }),
    searchProducts: build.query<ProductLookup[], string>({
      query: (q) => `/invoices/search?q=${encodeURIComponent(q)}`,
    }),
    getTicketSellers: build.query<TicketSeller[], void>({
      query: () => "/invoices/sellers",
    }),
    createInvoice: build.mutation<Invoice, NewInvoice>({
      query: (body) => ({ url: "/invoices", method: "POST", body }),
      invalidatesTags: ["Invoice"],
    }),
    updateInvoice: build.mutation<{ ok: boolean }, { id: string; body: NewInvoice }>({
      query: ({ id, body }) => ({ url: `/invoices/${id}`, method: "PUT", body }),
      invalidatesTags: ["Invoice"],
    }),
    voidInvoice: build.mutation<{ ok: boolean }, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/invoices/${id}/void`, method: "POST", body: { reason } }),
      invalidatesTags: ["Invoice"],
    }),
    linkInvoice: build.mutation<{ ok: boolean }, { id: string; orderId: string }>({
      query: ({ id, orderId }) => ({ url: `/invoices/${id}/link`, method: "POST", body: { orderId } }),
      invalidatesTags: ["Invoice", "Order"],
    }),
    deleteInvoice: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/invoices/${id}`, method: "DELETE" }),
      invalidatesTags: ["Invoice", "Product"],
    }),
  }),
});

export const {
  useGetInvoicesQuery,
  useLazyLookupProductQuery,
  useSearchProductsQuery,
  useGetTicketSellersQuery,
  useCreateInvoiceMutation,
  useUpdateInvoiceMutation,
  useVoidInvoiceMutation,
  useLinkInvoiceMutation,
  useDeleteInvoiceMutation,
} = invoicesApi;

