// API de Feedback público (bugs, ideas, pedidos de producto). El envío (POST) es
// público — cualquier visitante puede reportar sin sesión. Leer/gestionar (GET/PATCH)
// exige rol admin (el backend lo valida vía requireAdmin).
import { baseApi } from "./baseApi";

export type FeedbackType = "bug" | "idea" | "product";
export type FeedbackStatus = "new" | "resolved";

export interface Feedback {
  id: string;
  type: FeedbackType;
  message: string;
  userPhone: string | null;
  status: FeedbackStatus;
  createdAt: string | null;
}

export interface NewFeedback {
  type: FeedbackType;
  message: string;
  userPhone?: string;
}

export const feedbackApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getFeedback: build.query<Feedback[], void>({
      query: () => "/feedback",
      providesTags: ["Feedback"],
    }),
    sendFeedback: build.mutation<{ ok: boolean; id: string }, NewFeedback>({
      query: (body) => ({ url: "/feedback", method: "POST", body }),
      invalidatesTags: ["Feedback"],
    }),
    updateFeedbackStatus: build.mutation<{ ok: boolean }, { id: string; status: FeedbackStatus }>({
      query: ({ id, status }) => ({ url: `/feedback/${id}`, method: "PATCH", body: { status } }),
      invalidatesTags: ["Feedback"],
    }),
  }),
});

export const { useGetFeedbackQuery, useSendFeedbackMutation, useUpdateFeedbackStatusMutation } = feedbackApi;
