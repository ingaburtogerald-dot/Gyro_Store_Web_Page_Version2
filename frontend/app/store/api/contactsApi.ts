// API de Seguimientos (CRM ligero): contactos con historial de actividades.
// El servidor decide el alcance (admin todos / vendedor los suyos). Sin embudo:
// el contacto está `active` o `closed`, y su urgencia sale del próximo recordatorio.
import { baseApi } from "./baseApi";

export type ContactSource = "facebook_ads" | "social_chat" | "whatsapp" | "marketplace" | "other";
export type ContactTag = "retail" | "reseller" | "wholesale" | "vip";
export type ContactStatus = "active" | "closed";
export type ActivityType = "call" | "whatsapp" | "note" | "restock" | "meeting";
export type ActivityOutcome = "positive" | "neutral" | "negative" | null;

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  product: string;
  source: ContactSource;
  tags: ContactTag[];
  status: ContactStatus;
  ownerEmail: string;
  ownerName: string;
  nextActivityAt: string | null;
  lastActivityAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Activity {
  id: string;
  type: ActivityType;
  body: string;
  done: boolean;
  outcome: ActivityOutcome;
  authorEmail: string;
  authorName: string;
  dueAt: string | null;
  createdAt: string | null;
}

export interface NewContact {
  name: string;
  phone?: string;
  email?: string;
  product?: string;
  source?: ContactSource;
  tags?: ContactTag[];
  status?: ContactStatus;
}

// Cambio desde el board: reprogramar recordatorio y/o activar/cerrar.
export interface BoardPatch {
  status?: ContactStatus;
  nextActivityAt?: string | null;
}

export const contactsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getContacts: build.query<Contact[], { owner?: string } | void>({
      query: (args) => ({ url: "/contacts", params: args ?? undefined }),
      providesTags: ["Contact"],
    }),
    // Recordatorios por atender (campana + badge del menú).
    getAgenda: build.query<Contact[], void>({
      query: () => "/contacts/agenda",
      providesTags: ["Contact"],
    }),
    getActivities: build.query<Activity[], string>({
      query: (id) => `/contacts/${id}/activities`,
      providesTags: (_r, _e, id) => [{ type: "Activity", id }],
    }),
    createContact: build.mutation<Contact, NewContact>({
      query: (body) => ({ url: "/contacts", method: "POST", body }),
      invalidatesTags: ["Contact"],
    }),
    updateContact: build.mutation<Contact, { id: string; body: NewContact }>({
      query: ({ id, body }) => ({ url: `/contacts/${id}`, method: "PUT", body }),
      invalidatesTags: ["Contact"],
    }),
    addActivity: build.mutation<Activity, { contactId: string; body: Partial<Activity> }>({
      query: ({ contactId, body }) => ({ url: `/contacts/${contactId}/activities`, method: "POST", body }),
      invalidatesTags: (_r, _e, { contactId }) => [{ type: "Activity", id: contactId }, "Contact"],
    }),
    // Mover en el board por urgencia (reprogramar / activar-cerrar).
    updateBoard: build.mutation<{ ok: true }, { id: string; patch: BoardPatch; owner?: string }>({
      query: ({ id, patch }) => ({ url: `/contacts/${id}/board`, method: "PATCH", body: patch }),
      // Optimistic: la tarjeta se reubica al instante; si falla la red, se revierte.
      async onQueryStarted({ id, patch, owner }, { dispatch, queryFulfilled }) {
        const undo = dispatch(
          contactsApi.util.updateQueryData("getContacts", owner ? { owner } : undefined, (draft) => {
            const c = draft.find((x) => x.id === id);
            if (!c) return;
            if (patch.status !== undefined) c.status = patch.status;
            if (patch.nextActivityAt !== undefined) c.nextActivityAt = patch.nextActivityAt;
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          undo.undo();
        }
      },
    }),
    deleteContact: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/contacts/${id}`, method: "DELETE" }),
      invalidatesTags: ["Contact"],
    }),
  }),
});

export const {
  useGetContactsQuery,
  useGetAgendaQuery,
  useGetActivitiesQuery,
  useCreateContactMutation,
  useUpdateContactMutation,
  useAddActivityMutation,
  useUpdateBoardMutation,
  useDeleteContactMutation,
} = contactsApi;
