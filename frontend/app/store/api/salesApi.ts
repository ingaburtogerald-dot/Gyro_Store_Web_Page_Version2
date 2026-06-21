// API del portal de Ventas.
import { baseApi } from "./baseApi";

export type SaleStatus = "pending_approval" | "approved" | "rejected" | "paid";

export interface SaleItem {
  productId: string;
  code: string;
  name: string;
  variantName: string;
  quantity: number;
  salePrice: number;
  lineTotal: number;
  origin?: "native" | "migrated";
  mode?: "M1" | "M2";
  unitCostReal?: number;
  warrantyProcessed?: boolean;
  warrantyReason?: string;
}

export interface Sale {
  id: string;
  type: string;
  sellerEmail: string;
  sellerName: string;
  items: SaleItem[];
  saleTotal: number;
  status: SaleStatus;
  receiptPhotoUrl?: string;
  rejectionReason?: string;
  paymentScreenshotUrl?: string;
  costReal?: number;
  utilidadBruta?: number;
  costosFijos?: number;
  utilidadNeta?: number;
  comisionVendedor?: number;
  gananciaTienda?: number;
  createdAt: string | null;
  totalCostReal?: number;
  totalUtilidadBruta?: number;
  totalCostosFijos?: number;
  totalUtilidadNeta?: number;
  saleOrigin?: "native" | "migrated";
  insufficientStockError?: string | null;
}

export interface SellableProduct {
  id: string;
  code: string;
  name: string;
  price: number;
  stock: number;
  origin: "native" | "migrated";
}

export interface QuoteLine {
  productId: string;
  quantity: number;
  salePrice: number;
  variantName?: string;
  origin?: "native" | "migrated";
  mode?: "M1" | "M2";
}

export interface QuoteResult {
  saleTotal: number;
  saleOrigin?: "native" | "migrated";
  costReal: number;
  utilidadBruta: number;
  costosFijos: number;
  utilidadNeta: number;
  comisionVendedor: number;
  comisionPercent?: number;
  gananciaTienda: number;
  costosFijosPct: number;
}

export interface SellerPerformance {
  sellerEmail: string;
  sellerName: string;
  ventas: number;
  totalVendido: number;
  comisiones: number;
  comisionPromedio: number;
  ticketPromedio: number;
}

export interface Discount {
  minQty: number;
  maxQty: number | null;
  discountPercent: number;
}

export interface CostosFijos {
  publicidad: number;
  utiles: number;
  servicios: number;
  garantias: number;
}

export interface SellerSummary {
  ventasAprobadas: number;
  totalVendido: number;
  comisionGanada: number;
  enRevision: number;
}

export interface WeeklyPaymentGroup {
  sellerEmail: string;
  sellerName: string;
  weekOf: string;
  ventasAprobadasCount: number;
  totalVendido: number;
  comisionTotal: number;
  sales: Sale[];
}

export interface PaymentBatch {
  id: string;
  sellerEmail: string;
  sellerName: string;
  saleIds: string[];
  totalComision: number;
  grossComision?: number;
  saldoAplicado?: number;
  isSettlement?: boolean;
  paymentMethod: "cash" | "deposit";
  receiptUrl: string | null;
  noReceiptComment?: string | null;
  notifiedVia: "whatsapp" | "email";
  createdAt: string | null;
  createdBy: string;
}

export interface SellerBalance {
  sellerEmail: string;
  sellerName: string;
  balance: number; // + a favor del vendedor / − en contra (recibió de más)
  count: number;
}

export interface PublicOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  deliveryMethod: "retiro" | "envio";
  address: string;
  note: string;
  items: { name: string; quantity: number; price: number; lineTotal: number; variantName?: string }[];
  subtotal: number;
  discount: number;
  total: number;
  contacted: boolean;
  contactedAt: string | null;
  contactedBy: string | null;
  createdAt: string | null;
}

export interface BusinessConfig {
  storeName: string;
  storeAddress: string;
  whatsapp: string;
  exchangeRate: number;
  socialLinks: { instagram: string; facebook: string; tiktok: string };
  costosFijos: CostosFijos;
  wholesaleDiscounts: Discount[];
}

export const salesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSellableProducts: build.query<SellableProduct[], void>({
      query: () => "/sales/products",
      providesTags: ["Product"],
    }),
    getSales: build.query<Sale[], void>({
      query: () => "/sales",
      providesTags: ["Order"],
    }),
    getSalesPaginated: build.query<
      {
        data: Sale[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        summary: {
          ventasAprobadas: number;
          totalVendido: number;
          comisiones: number;
          gananciaTienda: number;
          inversionRecuperada: number;
          enRevision: number;
        };
      },
      { page: number; limit: number; sellerEmail?: string; date?: string; status?: string }
    >({
      query: (params) => ({
        url: "/sales",
        params: { ...params, paginate: "true" },
      }),
      providesTags: ["Order"],
    }),
    getSalesByIds: build.query<Sale[], string[]>({
      query: (ids) => ({
        url: "/sales",
        params: { ids: ids.join(",") },
      }),
      providesTags: ["Order"],
    }),
    getPerformance: build.query<SellerPerformance[], { year?: number; month?: number; allTime?: boolean } | void>({
      query: (arg) => {
        if (arg && typeof arg === "object") {
          return {
            url: "/sales/performance",
            params: { year: arg.year, month: arg.month, allTime: arg.allTime },
          };
        }
        return "/sales/performance";
      },
      providesTags: ["Order"],
    }),
    getSellerSummary: build.query<SellerSummary, void>({
      query: () => "/sales/my-summary",
      providesTags: ["Order"],
    }),
    getWeeklySummary: build.query<WeeklyPaymentGroup[], void>({
      query: () => "/sales/weekly-summary",
      providesTags: ["Order"],
    }),
    getPaymentsHistory: build.query<PaymentBatch[], void>({
      query: () => "/sales/payments",
      providesTags: ["Order"],
    }),
    getBalances: build.query<Record<string, SellerBalance>, void>({
      query: () => "/sales/balances",
      providesTags: ["Order"],
    }),
    settleBalance: build.mutation<
      { ok: boolean; paymentId: string; balance: number; receiptUrl: string | null; whatsappUrl?: string; notifiedVia: string },
      FormData
    >({
      query: (body) => ({ url: "/sales/settle-balance", method: "POST", body }),
      invalidatesTags: ["Order"],
    }),
    updatePaymentDate: build.mutation<{ ok: boolean }, { id: string; date: string }>({
      query: ({ id, date }) => ({
        url: `/sales/payments/${id}/date`,
        method: "PATCH",
        body: { date },
      }),
      invalidatesTags: ["Order"],
    }),
    getPricingConfig: build.query<{ wholesaleDiscounts: Discount[] }, void>({
      query: () => "/config/pricing",
      providesTags: ["Purchase"], // Refresh if purchases are updated/saved
    }),
    getBusinessConfig: build.query<{ costosFijos: CostosFijos }, void>({
      query: () => "/config/business",
    }),
    quoteSale: build.mutation<QuoteResult, { items: QuoteLine[] }>({
      query: (body) => ({ url: "/sales/quote", method: "POST", body }),
    }),
    reportSale: build.mutation<Sale, FormData>({
      query: (body) => ({ url: "/sales", method: "POST", body }),
      invalidatesTags: ["Order", "Product", "Migrated"],
    }),
    approveAndPayBulk: build.mutation<{ ok: boolean; receiptUrl: string; whatsappUrl?: string; notifiedVia: string }, FormData>({
      query: (body) => ({ url: "/sales/approve-and-pay", method: "POST", body }),
      invalidatesTags: ["Order", "Product", "Migrated"],
    }),
    approveSale: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/sales/${id}/approve`, method: "POST" }),
      invalidatesTags: ["Order", "Product", "Migrated"],
    }),
    updateSale: build.mutation<Sale, { id: string; body: FormData | any }>({
      query: ({ id, body }) => ({ url: `/sales/${id}`, method: "PUT", body }),
      invalidatesTags: ["Order", "Product", "Migrated"],
    }),
    deleteSale: build.mutation<{ ok: boolean }, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/sales/${id}`, method: "DELETE", body: { reason } }),
      invalidatesTags: ["Order", "Product", "Migrated"],
    }),
    rejectSale: build.mutation<{ ok: boolean }, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/sales/${id}/reject`, method: "POST", body: { reason } }),
      invalidatesTags: ["Order", "Product", "Migrated"],
    }),
    paySale: build.mutation<{ ok: boolean }, { id: string; body: FormData }>({
      query: ({ id, body }) => ({ url: `/sales/${id}/pay`, method: "POST", body }),
      invalidatesTags: ["Order"],
    }),
    payWeek: build.mutation<{ ok: boolean }, FormData>({
      query: (body) => ({ url: "/sales/pay-week", method: "POST", body }),
      invalidatesTags: ["Order"],
    }),
    updatePricingConfig: build.mutation<{ ok: boolean }, { wholesaleDiscounts: Discount[] }>({
      query: (body) => ({ url: "/config/pricing", method: "PUT", body }),
      invalidatesTags: ["Purchase", "Product"],
    }),
    updateCostosFijos: build.mutation<{ ok: boolean }, CostosFijos>({
      query: (body) => ({ url: "/config/costos-fijos", method: "PUT", body }),
      invalidatesTags: ["Order"],
    }),
    getFullConfig: build.query<BusinessConfig, void>({
      query: () => "/config/full",
      providesTags: ["Config"],
    }),
    updateBusinessConfig: build.mutation<{ ok: boolean }, Partial<BusinessConfig>>({
      query: (body) => ({ url: "/config/business", method: "PUT", body }),
      invalidatesTags: ["Config"],
    }),
    getPublicOrders: build.query<PublicOrder[], void>({
      query: () => "/orders/public",
      providesTags: ["PublicOrder"],
    }),
    markContacted: build.mutation<{ ok: boolean }, { id: string; contacted: boolean }>({
      query: ({ id, contacted }) => ({
        url: `/orders/public/${id}/contacted`,
        method: "PATCH",
        body: { contacted },
      }),
      invalidatesTags: ["PublicOrder"],
    }),
    processWarranty: build.mutation<
      { ok: boolean; costReal: number },
      { id: string; itemIndex: number; reason: string; notes?: string }
    >({
      query: ({ id, ...body }) => ({ url: `/sales/${id}/warranty`, method: "POST", body }),
      invalidatesTags: ["Order", "Product"],
    }),
  }),
});

export const {
  useGetSellableProductsQuery,
  useGetSalesQuery,
  useGetSalesPaginatedQuery,
  useGetSalesByIdsQuery,
  useGetPerformanceQuery,
  useGetSellerSummaryQuery,
  useGetWeeklySummaryQuery,
  useGetPaymentsHistoryQuery,
  useGetBalancesQuery,
  useSettleBalanceMutation,
  useUpdatePaymentDateMutation,
  useGetPricingConfigQuery,
  useGetBusinessConfigQuery,
  useGetFullConfigQuery,
  useGetPublicOrdersQuery,
  useQuoteSaleMutation,
  useReportSaleMutation,
  useApproveAndPayBulkMutation,
  useApproveSaleMutation,
  useUpdateSaleMutation,
  useDeleteSaleMutation,
  useRejectSaleMutation,
  usePaySaleMutation,
  usePayWeekMutation,
  useUpdatePricingConfigMutation,
  useUpdateCostosFijosMutation,
  useUpdateBusinessConfigMutation,
  useMarkContactedMutation,
  useProcessWarrantyMutation,
} = salesApi;

