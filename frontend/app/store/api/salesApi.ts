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
  // ── Financieros POR UNIDAD ──
  unitUtilidadBruta?: number;
  unitCostosFijos?: number;
  unitCostosFijosDesglose?: Record<string, number> | null;
  unitUtilidadNeta?: number;
  unitComisionVendedor?: number;
  unitGananciaTienda?: number;
  unitInversionRecuperada?: number;
  // ── Financieros TOTALES (unitario × cantidad) ──
  costReal?: number;
  utilidadBruta?: number;
  costosFijos?: number;
  costosFijosDesglose?: Record<string, number> | null;
  costosFijosPct?: number;
  utilidadNeta?: number;
  comisionVendedor?: number;
  comisionPercent?: number;
  gananciaTienda?: number;
  inversionRecuperada?: number;
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
  comisionPercent?: number; // % de comisión (lo agrega el backend en ventas pendientes)
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
  inversionRecuperada?: number;
  linesFinancials?: SaleItem[];
}

export interface TimeseriesPoint {
  /** Día del bucket en formato YYYY-MM-DD (UTC). */
  date: string;
  ventas: number;
  /** Comisión del vendedor en el período (no confidencial). */
  comision: number;
  /** Solo presente para roles admin (confidencial); 0 para vendedores. */
  ganancia: number;
}

export interface SellerPerformance {
  sellerEmail: string;
  sellerName: string;
  ventas: number;
  totalVendido: number;
  comisiones: number;
  comisionPromedio: number;
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

export interface MyBalance {
  comisionPorCobrar: number; // comisión de ventas aprobadas aún no pagadas
  ventasPorCobrar: number;
  comisionPendiente: number; // comisión ESTIMADA de ventas en revisión (no aprobadas)
  ventasPendientes: number; // cantidad de ventas en revisión
  saldo: number; // + a favor del vendedor / − en contra
  proximoPago: number; // comisionPorCobrar + saldo (mínimo 0)
}

export interface MySellerPayment {
  id: string;
  totalComision: number;
  saldoAplicado: number;
  isSettlement: boolean;
  ventasCount: number;
  saleIds: string[];
  paymentMethod: "cash" | "deposit";
  receiptUrl: string | null;
  noReceiptComment: string | null;
  createdAt: string | null;
  createdBy?: string;
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
  locationUrl?: string;
  note: string;
  items: { name: string; quantity: number; price: number; lineTotal: number; variantName?: string }[];
  subtotal: number;
  discount: number;
  total: number;
  contacted: boolean;
  contactedAt: string | null;
  contactedBy: string | null;
  contactAttempts: number;
  archived: boolean;
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
  deliveryPersonnel?: { id: string; name: string; phone: string }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Optimistic update: quita ventas de TODAS las listas cacheadas al instante, para
// que la fila desaparezca sin esperar el round-trip + refetch. Devuelve los patches
// para poder revertir si la mutación falla en el servidor.
// Usa selectInvalidatedBy para alcanzar cada variante de argumentos que esté viva
// (pendientes/historial, por vendedor, por fecha, del admin y del vendedor).
// ─────────────────────────────────────────────────────────────────────────────
function optimisticRemoveSales(
  ids: string[],
  dispatch: any,
  getState: any,
): { undo: () => void }[] {
  const idSet = new Set(ids);
  const patches: { undo: () => void }[] = [];
  const entries = salesApi.util.selectInvalidatedBy(getState(), [{ type: "Order" }]);
  for (const { endpointName, originalArgs } of entries) {
    if (endpointName === "getSalesPaginated") {
      patches.push(
        dispatch(
          salesApi.util.updateQueryData("getSalesPaginated", originalArgs as any, (draft) => {
            for (let i = draft.data.length - 1; i >= 0; i--) {
              if (!idSet.has(draft.data[i].id)) continue;
              if (draft.data[i].status === "pending_approval" && draft.summary) {
                draft.summary.enRevision = Math.max(0, draft.summary.enRevision - 1);
              }
              draft.data.splice(i, 1);
              if (typeof draft.total === "number") draft.total = Math.max(0, draft.total - 1);
            }
          }),
        ),
      );
    } else if (endpointName === "getSales") {
      patches.push(
        dispatch(
          salesApi.util.updateQueryData("getSales", originalArgs as any, (draft) => {
            for (let i = draft.length - 1; i >= 0; i--) {
              if (idSet.has(draft[i].id)) draft.splice(i, 1);
            }
          }),
        ),
      );
    }
  }
  return patches;
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
    getSalesTimeseries: build.query<
      { data: TimeseriesPoint[]; granularity: "day" | "month"; isMock: boolean },
      { date?: string; sellerEmail?: string } | void
    >({
      query: (arg) => ({
        url: "/sales/timeseries",
        params: arg ?? undefined,
      }),
      providesTags: ["OrderAgg"],
    }),
    getPerformance: build.query<{ data: SellerPerformance[]; companyTotalSales: number }, { year?: number; month?: number; allTime?: boolean } | void>({
      query: (arg) => {
        if (arg && typeof arg === "object") {
          return {
            url: "/sales/performance",
            params: { year: arg.year, month: arg.month, allTime: arg.allTime },
          };
        }
        return "/sales/performance";
      },
      providesTags: ["OrderAgg"],
    }),
    getSellerSummary: build.query<SellerSummary, void>({
      query: () => "/sales/my-summary",
      providesTags: ["OrderAgg"],
    }),
    getMyBalance: build.query<MyBalance, void>({
      query: () => "/sales/my-balance",
      providesTags: ["OrderAgg"],
    }),
    getMyPayments: build.query<MySellerPayment[], void>({
      query: () => "/sales/my-payments",
      providesTags: ["OrderAgg"],
    }),
    getWeeklySummary: build.query<WeeklyPaymentGroup[], void>({
      query: () => "/sales/weekly-summary",
      providesTags: ["OrderAgg"],
    }),
    getPaymentsHistory: build.query<PaymentBatch[], void>({
      query: () => "/sales/payments",
      providesTags: ["OrderAgg"],
    }),
    getBalances: build.query<Record<string, SellerBalance>, void>({
      query: () => "/sales/balances",
      providesTags: ["OrderAgg"],
    }),
    settleBalance: build.mutation<
      { ok: boolean; paymentId: string; balance: number; receiptUrl: string | null; whatsappUrl?: string; notifiedVia: string },
      FormData
    >({
      query: (body) => ({ url: "/sales/settle-balance", method: "POST", body }),
      invalidatesTags: ["Order", "OrderAgg"],
    }),
    updatePaymentDate: build.mutation<{ ok: boolean }, { id: string; date: string }>({
      query: ({ id, date }) => ({
        url: `/sales/payments/${id}/date`,
        method: "PATCH",
        body: { date },
      }),
      invalidatesTags: ["OrderAgg"],
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
    // El backend crea UNA venta por producto distinto: devuelve la primera
    // (compatibilidad) más `ids`/`count` del lote creado.
    reportSale: build.mutation<Sale & { ids?: string[]; count?: number }, FormData>({
      query: (body) => ({ url: "/sales", method: "POST", body }),
      invalidatesTags: ["Order", "Product", "Migrated"],
    }),
    approveAndPayBulk: build.mutation<{ ok: boolean; receiptUrl: string; whatsappUrl?: string; notifiedVia: string }, FormData>({
      query: (body) => ({ url: "/sales/approve-and-pay", method: "POST", body }),
      invalidatesTags: ["Order", "OrderAgg", "Product", "Migrated"],
      async onQueryStarted(form, { dispatch, getState, queryFulfilled }) {
        let ids: string[] = [];
        try {
          ids = JSON.parse((form.get("saleIds") as string) || "[]");
        } catch {
          ids = [];
        }
        const patches = optimisticRemoveSales(ids, dispatch, getState);
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((p) => p.undo());
        }
      },
    }),
    approveSale: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/sales/${id}/approve`, method: "POST" }),
      invalidatesTags: ["Order", "OrderAgg", "Product", "Migrated"],
      async onQueryStarted(id, { dispatch, getState, queryFulfilled }) {
        const patches = optimisticRemoveSales([id], dispatch, getState);
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((p) => p.undo());
        }
      },
    }),
    updateSale: build.mutation<Sale, { id: string; body: FormData | any }>({
      query: ({ id, body }) => ({ url: `/sales/${id}`, method: "PUT", body }),
      invalidatesTags: ["Order", "OrderAgg", "Product", "Migrated"],
    }),
    deleteSale: build.mutation<{ ok: boolean }, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/sales/${id}`, method: "DELETE", body: { reason } }),
      invalidatesTags: ["Order", "OrderAgg", "Product", "Migrated"],
      async onQueryStarted({ id }, { dispatch, getState, queryFulfilled }) {
        const patches = optimisticRemoveSales([id], dispatch, getState);
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((p) => p.undo());
        }
      },
    }),
    rejectSale: build.mutation<{ ok: boolean }, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/sales/${id}/reject`, method: "POST", body: { reason } }),
      // Rechazar solo aplica a ventas PENDIENTES (no cuentan en los agregados de
      // aprobadas/pagadas), así que NO invalidamos "OrderAgg": evita el refetch
      // innecesario de timeseries/performance/balances.
      invalidatesTags: ["Order", "Product", "Migrated"],
      async onQueryStarted({ id }, { dispatch, getState, queryFulfilled }) {
        const patches = optimisticRemoveSales([id], dispatch, getState);
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((p) => p.undo());
        }
      },
    }),
    paySale: build.mutation<{ ok: boolean }, { id: string; body: FormData }>({
      query: ({ id, body }) => ({ url: `/sales/${id}/pay`, method: "POST", body }),
      invalidatesTags: ["Order", "OrderAgg"],
    }),
    payWeek: build.mutation<{ ok: boolean }, FormData>({
      query: (body) => ({ url: "/sales/pay-week", method: "POST", body }),
      invalidatesTags: ["Order", "OrderAgg"],
    }),
    updatePricingConfig: build.mutation<{ ok: boolean }, { wholesaleDiscounts: Discount[] }>({
      query: (body) => ({ url: "/config/pricing", method: "PUT", body }),
      invalidatesTags: ["Purchase", "Product"],
    }),
    updateCostosFijos: build.mutation<{ ok: boolean }, CostosFijos>({
      query: (body) => ({ url: "/config/costos-fijos", method: "PUT", body }),
      invalidatesTags: ["Order", "OrderAgg"],
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
    logOrderFollowUp: build.mutation<{ ok: boolean; contactAttempts: number; archived: boolean }, string>({
      query: (id) => ({ url: `/orders/public/${id}/follow-up`, method: "PATCH" }),
      invalidatesTags: ["PublicOrder"],
    }),
    deletePublicOrder: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/orders/public/${id}`, method: "DELETE" }),
      invalidatesTags: ["PublicOrder"],
    }),
  }),
});

export const {
  useGetSellableProductsQuery,
  useGetSalesQuery,
  useGetSalesPaginatedQuery,
  useGetSalesByIdsQuery,
  useGetSalesTimeseriesQuery,
  useGetPerformanceQuery,
  useGetSellerSummaryQuery,
  useGetMyBalanceQuery,
  useGetMyPaymentsQuery,
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
  useLogOrderFollowUpMutation,
  useDeletePublicOrderMutation,
} = salesApi;

