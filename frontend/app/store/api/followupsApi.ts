// API del CRM de seguimientos. Admin ve todos; vendedor los suyos (lo decide el server).
import { baseApi } from "./baseApi";

export type FollowupType = "callback" | "restock" | "other";
export type FollowupStatus = "pending" | "done" | "lost";

export interface Followup {
  id: string;
  customerName: string;
  customerPhone: string;
  type: FollowupType;
  product: string;
  note: string;
  followUpDate: string; // YYYY-MM-DD
  status: FollowupStatus;
  ownerEmail: string;
  ownerName: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface NewFollowup {
  customerName: string;
  customerPhone?: string;
  type: FollowupType;
  product?: string;
  note?: string;
  followUpDate: string;
  status?: FollowupStatus;
}

export const followupsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getFollowups: build.query<Followup[], void>({
      query: () => "/followups",
      providesTags: ["Followup"],
    }),
    createFollowup: build.mutation<Followup, NewFollowup>({
      query: (body) => ({ url: "/followups", method: "POST", body }),
      invalidatesTags: ["Followup"],
    }),
    updateFollowup: build.mutation<Followup, { id: string; body: NewFollowup }>({
      query: ({ id, body }) => ({ url: `/followups/${id}`, method: "PUT", body }),
      invalidatesTags: ["Followup"],
    }),
    setFollowupStatus: build.mutation<{ ok: boolean }, { id: string; status: FollowupStatus }>({
      query: ({ id, status }) => ({ url: `/followups/${id}/status`, method: "PATCH", body: { status } }),
      invalidatesTags: ["Followup"],
    }),
    deleteFollowup: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/followups/${id}`, method: "DELETE" }),
      invalidatesTags: ["Followup"],
    }),
  }),
});

export const {
  useGetFollowupsQuery,
  useCreateFollowupMutation,
  useUpdateFollowupMutation,
  useSetFollowupStatusMutation,
  useDeleteFollowupMutation,
} = followupsApi;
