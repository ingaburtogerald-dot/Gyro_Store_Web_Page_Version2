// API de Gestión de Usuarios.
import { baseApi } from "./baseApi";
import type { Role } from "~/lib/constants";

export interface ManagedUser {
  id: string;
  uid?: string;
  email: string;
  displayName: string;
  photoURL?: string;
  provider: "local" | "google" | "microsoft";
  roles: Role[];
  isProtected: boolean;
  createdAt: string | null;
}

export interface TrashedUser extends ManagedUser {
  daysLeft: number;
}

export interface NewUser {
  email: string;
  displayName: string;
  roles: Role[];
  provider: "local" | "google" | "microsoft";
}

export const usersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getUsers: build.query<ManagedUser[], void>({
      query: () => "/users",
      providesTags: ["User"],
    }),
    getTrash: build.query<TrashedUser[], void>({
      query: () => "/users/trash",
      providesTags: ["User"],
    }),
    createUser: build.mutation<ManagedUser & { tempPassword?: string }, NewUser>({
      query: (body) => ({ url: "/users", method: "POST", body }),
      invalidatesTags: ["User"],
    }),
    updateUser: build.mutation<{ ok: boolean }, { id: string; displayName?: string; roles?: Role[] }>({
      query: ({ id, ...body }) => ({ url: `/users/${id}`, method: "PATCH", body }),
      invalidatesTags: ["User"],
    }),
    deleteUser: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/users/${id}`, method: "DELETE" }),
      invalidatesTags: ["User"],
    }),
    restoreUser: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/users/trash/${id}/restore`, method: "POST" }),
      invalidatesTags: ["User"],
    }),
    purgeUser: build.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/users/trash/${id}`, method: "DELETE" }),
      invalidatesTags: ["User"],
    }),
    generateTempPassword: build.mutation<{ tempPassword: string; email: string }, string>({
      query: (id) => ({ url: `/users/${id}/temp-password`, method: "POST" }),
      invalidatesTags: ["User"],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useGetTrashQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useRestoreUserMutation,
  usePurgeUserMutation,
  useGenerateTempPasswordMutation,
} = usersApi;
