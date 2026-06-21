// API para ventas en cuotas (solo admin).
import { baseApi } from "./baseApi";

export interface InstallmentPayment {
  amount: number;
  paymentDate: string;
  nextPaymentDate?: string;
  paymentMethod?: "efectivo" | "transferencia" | "tarjeta";
  notes?: string;
  registeredBy?: string;
  createdAt?: string;
}

export interface Installment {
  id: string;
  customerName: string;
  customerPhone: string;
  sellerName: string;
  sellerEmail: string;
  items: { productId: string; name: string; quantity: number; salePrice: number }[];
  totalAmount: number;
  numInstallments: number;
  installmentAmount: number;
  amountPaid: number;
  amountPending: number;
  status: "active" | "completed";
  firstPaymentDate: string;
  nextPaymentDate: string | null;
  payments: InstallmentPayment[];
  notes: string;
  createdAt: string | null;
  completedAt: string | null;
}

export interface NewInstallment {
  customerName: string;
  customerPhone?: string;
  sellerEmail?: string;
  sellerName?: string;
  sellerUid?: string;
  items: { productId: string; name: string; quantity: number; salePrice: number }[];
  totalAmount: number;
  numInstallments: number;
  installmentAmount: number;
  firstPaymentDate: string;
  notes?: string;
}

export interface NewInstallmentPayment {
  amount: number;
  paymentDate: string;
  nextPaymentDate?: string;
  paymentMethod?: "efectivo" | "transferencia" | "tarjeta";
  notes?: string;
}

export const installmentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getInstallments: build.query<Installment[], void>({
      query: () => "/installments",
      providesTags: ["Installment"],
    }),
    getPendingInstallments: build.query<Installment[], void>({
      query: () => "/installments/pending",
      providesTags: ["Installment"],
    }),
    createInstallment: build.mutation<Installment, NewInstallment>({
      query: (body) => ({ url: "/installments", method: "POST", body }),
      invalidatesTags: ["Installment", "Product"],
    }),
    addInstallmentPayment: build.mutation<
      { ok: boolean; amountPaid: number; amountPending: number; completed: boolean },
      { id: string; body: NewInstallmentPayment }
    >({
      query: ({ id, body }) => ({ url: `/installments/${id}/payments`, method: "POST", body }),
      invalidatesTags: ["Installment"],
    }),
    deleteInstallment: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/installments/${id}`, method: "DELETE" }),
      invalidatesTags: ["Installment"],
    }),
  }),
});

export const {
  useGetInstallmentsQuery,
  useGetPendingInstallmentsQuery,
  useCreateInstallmentMutation,
  useAddInstallmentPaymentMutation,
  useDeleteInstallmentMutation,
} = installmentsApi;
