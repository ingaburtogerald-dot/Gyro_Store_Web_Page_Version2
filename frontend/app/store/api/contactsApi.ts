// API del CRM v2: contactos/leads con historial de actividades.
// El servidor decide el alcance (admin todos / vendedor los suyos) y hace el
// filtrado, orden y paginación. Convive con followupsApi (legacy) durante la migración.
import { baseApi } from "./baseApi";

export type CrmStage = "new" | "contacted" | "negotiating" | "won" | "lost";
export type ActivityType = "call" | "whatsapp" | "note" | "restock" | "meeting";
export type ActivityOutcome = "positive" | "neutral" | "negative" | null;

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  product: string;
  source: string;
  tags: string[];
  value: number;
  stage: CrmStage;
  stageOrder: number;
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
  source?: string;
  value?: number;
  tags?: string[];
  stage?: CrmStage;
}

export interface ContactMetrics {
  byStage: Record<CrmStage, number>;
  total: number;
  conversionRate: number;
}

export interface ContactsPage {
  items: Contact[];
  nextCursor: string | null;
}

export interface ContactsQueryArgs {
  owner?: string;
  stage?: CrmStage;
  cursor?: string;
}

export const contactsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getContacts: build.query<ContactsPage, ContactsQueryArgs | void>({
      query: (args) => ({ url: "/contacts", params: args ?? undefined }),
      providesTags: ["Contact"],
    }),
    getContactMetrics: build.query<ContactMetrics, { owner?: string } | void>({
      query: (args) => ({ url: "/contacts/metrics", params: args ?? undefined }),
      providesTags: ["ContactMetrics"],
    }),
    // Tareas por atender (campana + badge del menú). El servidor envía una ventana
    // holgada; el cliente clasifica exacto (vencido/hoy) con su hora local.
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
      invalidatesTags: ["Contact", "ContactMetrics"],
    }),
    updateContact: build.mutation<Contact, { id: string; body: NewContact }>({
      query: ({ id, body }) => ({ url: `/contacts/${id}`, method: "PUT", body }),
      invalidatesTags: ["Contact"],
    }),
    addActivity: build.mutation<Activity, { contactId: string; body: Partial<Activity> }>({
      query: ({ contactId, body }) => ({ url: `/contacts/${contactId}/activities`, method: "POST", body }),
      invalidatesTags: (_r, _e, { contactId }) => [{ type: "Activity", id: contactId }, "Contact"],
    }),
    moveStage: build.mutation<{ ok: true }, { id: string; stage: CrmStage; stageOrder: number; owner?: string }>({
      query: ({ id, stage, stageOrder }) => ({
        url: `/contacts/${id}/stage`,
        method: "PATCH",
        body: { stage, stageOrder },
      }),
      // Optimistic: la tarjeta se mueve al instante; si falla la red, se revierte.
      async onQueryStarted({ id, stage, stageOrder, owner }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          contactsApi.util.updateQueryData(
            "getContacts",
            owner ? { owner } : undefined,
            (draft) => {
              const c = draft.items.find((x) => x.id === id);
              if (c) {
                c.stage = stage;
                c.stageOrder = stageOrder;
              }
            },
          ),
        );
        try {
          await queryFulfilled;
          // Refresca métricas (won/lost cambian la conversión) sin refetch de la lista.
          dispatch(baseApi.util.invalidateTags(["ContactMetrics"]));
        } catch {
          patch.undo();
        }
      },
    }),
    deleteContact: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/contacts/${id}`, method: "DELETE" }),
      invalidatesTags: ["Contact", "ContactMetrics"],
    }),
  }),
});

export const {
  useGetContactsQuery,
  useGetContactMetricsQuery,
  useGetAgendaQuery,
  useGetActivitiesQuery,
  useCreateContactMutation,
  useUpdateContactMutation,
  useAddActivityMutation,
  useMoveStageMutation,
  useDeleteContactMutation,
} = contactsApi;
