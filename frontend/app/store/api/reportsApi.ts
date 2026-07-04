// API del portal de Reportería.
import { baseApi } from "./baseApi";

export interface ReportKpisData {
  inversionUsd: number;
  inversionCordobas: number;
  impuestosUsd: number;
  enviosUsd: number;
  ventasCordobas: number;
  comisionesCordobas: number;
  costosFijosCordobas: number;
  gananciaTiendaCordobas: number;
  totalCostoVentaCordobas: number;
  perdidasCordobas: number;
  gananciaNetaCordobas: number;
  // Desglose de deducciones (siempre presente; ver server/services/reports.js)
  perdidasInventarioCordobas: number;
  gastosExcedenteCordobas: number;
  gastosVariosCordobas: number;
  margenPct: number;
}

// Una fila de la tabla Presupuesto vs Gasto (por grupo de gasto).
export interface BudgetRow {
  group: string;
  label: string;
  budgeted: boolean;
  pool: number;
  spent: number;
  saldo: number;
  excedente: number;
}

export interface ReportData {
  range: { year: number; month: number | null };
  kpis: ReportKpisData;
  charts: {
    monthly: { month: string; inversion: number; ventas: number; ganancia?: number; gananciaNeta?: number; comisiones?: number }[];
    costosFijos: { name: string; value: number }[];
    performance: { sellerName: string; totalVendido: number; comisiones?: number }[];
    presupuestoVsGasto: BudgetRow[];
  };
}

export type LossCategory = "robo" | "daño" | "devolucion";

// Registro almacenado en la colección `losses`: puede ser pérdida de inventario o gasto.
export interface LossRecord {
  id: string;
  kind?: "inventory_loss" | "expense";
  date: string;
  amount: number;
  currency: "C$" | "USD";
  reason?: string;
  registeredBy?: string;
  // inventory_loss
  productCode?: string;
  productName?: string;
  quantity?: number;
  origin?: "native" | "migrated";
  category?: LossCategory;
  // expense
  group?: string;
  subcategory?: string;
}

export interface LossProduct {
  id: string;
  code: string;
  name: string;
  stock: number;
  origin: "native" | "migrated";
}

export interface ExpenseGroup {
  key: string;
  label: string;
  budgeted: boolean;
}

export interface ExpenseCategories {
  groups: ExpenseGroup[];
  subcategoriesByGroup: Record<string, string[]>;
}

export interface NewInventoryLoss {
  date: string;
  productId: string;
  origin: "native" | "migrated";
  quantity: number;
  category: LossCategory;
  reason?: string;
}

export interface NewExpense {
  date: string;
  amount: number;
  currency: "C$" | "USD";
  group: string;
  subcategory?: string;
  reason?: string;
}

export const reportsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getReport: build.query<ReportData, { year: number; month?: number | null }>({
      query: ({ year, month }) =>
        month == null ? `/reports?year=${year}` : `/reports?year=${year}&month=${month}`,
      providesTags: ["Report"],
    }),
    getLosses: build.query<LossRecord[], { year: number; month?: number | null }>({
      query: ({ year, month }) =>
        month == null ? `/reports/losses?year=${year}` : `/reports/losses?year=${year}&month=${month}`,
      providesTags: ["Report"],
    }),
    getLossProducts: build.query<LossProduct[], void>({
      query: () => "/reports/products",
      providesTags: ["Report"],
    }),
    getExpenseCategories: build.query<ExpenseCategories, void>({
      query: () => "/reports/expense-categories",
      providesTags: ["Report"],
    }),
    createLoss: build.mutation<LossRecord, NewInventoryLoss>({
      query: (body) => ({ url: "/reports/losses", method: "POST", body }),
      invalidatesTags: ["Report"],
    }),
    updateLoss: build.mutation<LossRecord, { id: string; date: string; category: LossCategory; reason?: string }>({
      query: ({ id, ...body }) => ({ url: `/reports/losses/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Report"],
    }),
    createExpense: build.mutation<LossRecord, NewExpense>({
      query: (body) => ({ url: "/reports/expenses", method: "POST", body }),
      invalidatesTags: ["Report"],
    }),
    updateExpense: build.mutation<LossRecord, NewExpense & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/reports/expenses/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Report"],
    }),
  }),
});

export const {
  useGetReportQuery,
  useGetLossesQuery,
  useGetLossProductsQuery,
  useGetExpenseCategoriesQuery,
  useCreateLossMutation,
  useUpdateLossMutation,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
} = reportsApi;
