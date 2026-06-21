// Estado de sesión. La fuente de verdad de los roles es el backend (/api/auth/me);
// aquí solo cacheamos el usuario resuelto para la UI. NO se confía en localStorage
// como fuente de verdad de permisos.
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { SessionUser } from "~/lib/authStrategies";
import { ADMIN_ROLES, type Role } from "~/lib/constants";

type Status = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  user: SessionUser | null;
  status: Status;
  editMode: boolean; // modo edición del catálogo (solo admin)
}

const initialState: AuthState = {
  user: null,
  status: "loading",
  editMode: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<SessionUser>) {
      state.user = action.payload;
      state.status = "authenticated";
    },
    clearUser(state) {
      state.user = null;
      state.status = "unauthenticated";
      state.editMode = false;
    },
    setStatus(state, action: PayloadAction<Status>) {
      state.status = action.payload;
    },
    toggleEditMode(state) {
      state.editMode = !state.editMode;
    },
    setEditMode(state, action: PayloadAction<boolean>) {
      state.editMode = action.payload;
    },
  },
});

export const { setUser, clearUser, setStatus, toggleEditMode, setEditMode } = authSlice.actions;
export default authSlice.reducer;

// Selectores
// Referencia estable para "sin roles": devolver `[]` nuevo en cada llamada rompe
// useSyncExternalStore (el snapshot debe ser cacheado). Siempre la misma referencia.
const EMPTY_ROLES: Role[] = [];

export const selectUser = (s: { auth: AuthState }) => s.auth.user;
export const selectStatus = (s: { auth: AuthState }) => s.auth.status;
export const selectRoles = (s: { auth: AuthState }): Role[] => s.auth.user?.roles ?? EMPTY_ROLES;
export const selectIsAdmin = (s: { auth: AuthState }) =>
  (s.auth.user?.roles ?? []).some((r) => ADMIN_ROLES.includes(r));
export const selectEditMode = (s: { auth: AuthState }) => s.auth.editMode;
