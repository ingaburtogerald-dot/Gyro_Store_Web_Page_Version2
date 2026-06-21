// Sesión de la app. El listener de Firebase (onAuthStateChanged) se monta UNA sola
// vez a nivel global vía useAuthBootstrap() en el root — nunca dentro de un componente
// protegido, para no crear un deadlock con el gate de roles. useAuth() solo expone el
// estado y las acciones login/logout.
import { useCallback, useEffect } from "react";
import { getFirebaseAuth, onAuthStateChanged, signOut } from "~/lib/firebase.client";
import { resolveAuthProvider, type AuthStrategy, type SessionUser } from "~/lib/authStrategies";
import { useAppDispatch, useAppSelector } from "~/store/hooks";
import {
  setUser,
  clearUser,
  setStatus,
  selectUser,
  selectStatus,
} from "~/store/slices/authSlice";

// Bandera de módulo: evita el doble fetch a /api/auth/me cuando login() ya resolvió
// al usuario y el listener dispara inmediatamente después del signIn.
let justLoggedIn = false;

// Se llama UNA vez, en el root, para arrancar el listener de sesión.
export function useAuthBootstrap() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      let auth;
      try {
        auth = await getFirebaseAuth();
      } catch {
        dispatch(setStatus("unauthenticated"));
        return;
      }
      unsub = onAuthStateChanged(auth, async (fbUser) => {
        if (justLoggedIn) {
          justLoggedIn = false;
          return;
        }
        if (!fbUser) {
          dispatch(clearUser());
          return;
        }
        try {
          const token = await fbUser.getIdToken();
          const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) throw new Error("no-auth");
          const me = await res.json();
          dispatch(
            setUser({
              uid: fbUser.uid,
              email: me.email,
              name: fbUser.displayName || me.name || me.email.split("@")[0],
              photoURL: fbUser.photoURL || me.photoURL || "",
              role: me.role,
              roles: me.roles || [],
              mustChangePassword: me.mustChangePassword,
              authProvider: resolveAuthProvider(fbUser),
              providers: (fbUser?.providerData || []).map((p: any) => p?.providerId),
            } as SessionUser),
          );
        } catch {
          dispatch(clearUser());
        }
      });
    })();
    return () => unsub();
  }, [dispatch]);
}

export function useAuth() {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const status = useAppSelector(selectStatus);

  const login = useCallback(
    async (strategy: AuthStrategy) => {
      justLoggedIn = true;
      const sessionUser = await strategy.execute();
      dispatch(setUser(sessionUser));
      return sessionUser;
    },
    [dispatch],
  );

  const logout = useCallback(async () => {
    dispatch(clearUser());
    try {
      const auth = await getFirebaseAuth();
      await signOut(auth).catch(() => {});
    } catch {
      /* noop */
    }
  }, [dispatch]);

  return { user, status, login, logout };
}
