// API base de RTK Query. Todas las API slices (catalogApi, inventoryApi, etc.)
// se inyectan sobre esta para compartir caché, baseUrl y el token de Firebase.
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { getIdToken } from "~/lib/authStrategies";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
    prepareHeaders: async (headers) => {
      // El token se obtiene en tiempo real de Firebase (no de localStorage).
      const token = await getIdToken().catch(() => null);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return headers;
    },
  }),
  // Tags para invalidación de caché entre fases (productos, ventas, usuarios, etc.)
  tagTypes: [
    "Config",
    "Landing",
    "Catalog",
    "Template",
    "Combo",
    "Product",
    "Purchase",
    "Migrated",
    "Order",
    // Agregados derivados de ventas (timeseries, performance, balances, pagos…).
    // Separado de "Order" para que editar/rechazar una fila NO dispare el refetch
    // de todos los widgets de resumen — solo lo que realmente cambió.
    "OrderAgg",
    "PublicOrder",
    "Invoice",
    "User",
    "Shipment",
    "Report",
    "Installment",
    "Followup",
    "Contact",
    "Activity",
    "SearchAnalytics",
    "Feedback",
    "DiscountCode",
  ],
  endpoints: () => ({}),
});
