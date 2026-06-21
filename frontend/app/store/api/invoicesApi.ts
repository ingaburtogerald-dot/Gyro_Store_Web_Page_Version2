// API del portal de Facturación.
import { baseApi } from "./baseApi";

export interface InvoiceItem {
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export type InvoiceStatus = "unlinked" | "linked" | "paid";

export interface Invoice {
  id: string;
  ticketNumber: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  sellerName: string;
  linkedToOrder: string | null;
  status: InvoiceStatus;
  createdAt: string | null;
}

export interface NewInvoice {
  items: { productCode: string; productName: string; quantity: number; unitPrice: number }[];
  discount: number;
  paymentMethod: string;
}

export interface ProductLookup {
  code: string;
  name: string;
  price: number;
  stock: number;
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
    createInvoice: build.mutation<Invoice, NewInvoice>({
      query: (body) => ({ url: "/invoices", method: "POST", body }),
      invalidatesTags: ["Invoice"],
    }),
    linkInvoice: build.mutation<{ ok: boolean }, { id: string; orderId: string }>({
      query: ({ id, orderId }) => ({ url: `/invoices/${id}/link`, method: "POST", body: { orderId } }),
      invalidatesTags: ["Invoice", "Order"],
    }),
  }),
});

export const {
  useGetInvoicesQuery,
  useLazyLookupProductQuery,
  useCreateInvoiceMutation,
  useLinkInvoiceMutation,
} = invoicesApi;
