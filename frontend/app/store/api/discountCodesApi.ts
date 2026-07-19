// API de códigos de descuento (incentivo por reseña en Google/Facebook). Crear/
// listar/activar-desactivar es admin-only; validar (preview) es público — lo usa
// el checkout para dar feedback instantáneo sin gastar un uso del código.
import { baseApi } from "./baseApi";

export type DiscountType = "percent" | "fixed";

export interface DiscountCode {
  code: string;
  type: DiscountType;
  value: number;
  maxUses: number; // 0 = ilimitado
  usedCount: number;
  active: boolean;
  expiresAt: string | null;
  note: string;
  createdAt: string | null;
  createdBy: string;
}

export interface NewDiscountCode {
  code: string;
  type: DiscountType;
  value: number;
  maxUses?: number;
  expiresAt?: string;
  note?: string;
}

export interface DiscountCodeValidation {
  ok: true;
  code: string;
  type: DiscountType;
  value: number;
}

export const discountCodesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDiscountCodes: build.query<DiscountCode[], void>({
      query: () => "/discount-codes",
      providesTags: ["DiscountCode"],
    }),
    createDiscountCode: build.mutation<DiscountCode, NewDiscountCode>({
      query: (body) => ({ url: "/discount-codes", method: "POST", body }),
      invalidatesTags: ["DiscountCode"],
    }),
    setDiscountCodeActive: build.mutation<{ ok: boolean }, { code: string; active: boolean }>({
      query: ({ code, active }) => ({ url: `/discount-codes/${code}`, method: "PATCH", body: { active } }),
      invalidatesTags: ["DiscountCode"],
    }),
    // Público: preview de solo lectura (no consume uso). Devuelve rejectedWithValue
    // con el mensaje del servidor si el código no es válido — el checkout lo muestra tal cual.
    validateDiscountCode: build.mutation<DiscountCodeValidation, string>({
      query: (code) => ({ url: "/discount-codes/validate", method: "POST", body: { code } }),
    }),
  }),
});

export const {
  useGetDiscountCodesQuery,
  useCreateDiscountCodeMutation,
  useSetDiscountCodeActiveMutation,
  useValidateDiscountCodeMutation,
} = discountCodesApi;
