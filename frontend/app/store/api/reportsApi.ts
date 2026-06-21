// API del portal de Reportería.
import { baseApi } from "./baseApi";

export interface ReportKpisData {
  inversionUsd: number;
  inversionCordobas: number;
  impuestosUsd: number;
  enviosUsd: number;
  ventasCordobas: number;
  comisionesCordobas: number;
  costosFijosCordobas?: number;
  gananciaTiendaCordobas?: number;
  totalCostoVentaCordobas?: number;
  perdidasCordobas: number;
  gananciaNetaCordobas: number;
  margenPct: number;
}

export interface ReportData {
  range: { year: number; month: number | null };
  kpis: ReportKpisData;
  charts: {
    monthly: { month: string; inversion: number; ventas: number; ganancia?: number; gananciaNeta?: number; comisiones?: number }[];
    costosFijos: { name: string; value: number }[];
    performance: { sellerName: string; totalVendido: number; comisiones?: number }[];
  };
}

export type LossCategory = "robo" | "daño" | "devolucion" | "otro";

export interface Loss {
  id: string;
  date: string;
  amount: number;
  currency: "C$" | "USD";
  reason: string;
  category: LossCategory;
  registeredBy?: string;
}

export interface NewLoss {
  date: string;
  amount: number;
  currency: "C$" | "USD";
  reason: string;
  category: LossCategory;
}

export const reportsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getReport: build.query<ReportData, { year: number; month?: number | null }>({
      query: ({ year, month }) =>
        month == null ? `/reports?year=${year}` : `/reports?year=${year}&month=${month}`,
      providesTags: ["Report"],
    }),
    getLosses: build.query<Loss[], void>({
      query: () => "/reports/losses",
      providesTags: ["Report"],
    }),
    createLoss: build.mutation<Loss, NewLoss>({
      query: (body) => ({ url: "/reports/losses", method: "POST", body }),
      invalidatesTags: ["Report"],
    }),
  }),
});

export const { useGetReportQuery, useGetLossesQuery, useCreateLossMutation } = reportsApi;
