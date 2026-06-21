// Estrategias de login (patrón Strategy, reciclado del proyecto anterior y migrado
// a TS). Cada estrategia autentica con Firebase y resuelve roles vía /api/auth/me.
import {
  getFirebaseAuth,
  GoogleAuthProvider,
  microsoftProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
} from "./firebase.client";
import type { Role } from "./constants";

export interface SessionUser {
  uid: string;
  email: string;
  name: string;
  photoURL: string;
  role: Role | null;
  roles: Role[];
  mustChangePassword?: boolean;
  // Proveedor de autenticación principal: "password" = cuenta local (email/contraseña),
  // "google.com" / "microsoft.com" = OAuth/SSO.
  authProvider?: string;
  // Lista completa de proveedores vinculados (ej. ["password", "google.com"])
  providers?: string[];
  whatsapp?: string;
}

// Resuelve el proveedor principal desde el usuario de Firebase.
export function resolveAuthProvider(fbUser: any): string {
  const providers: string[] = (fbUser?.providerData || []).map((p: any) => p?.providerId);
  if (providers.includes("password")) return "password";
  return providers[0] || "password";
}

// Confirma el token contra el backend y obtiene los roles desde Firestore/env.
async function fetchMe(token: string) {
  const res = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data as { email: string; name: string; photoURL?: string; role: Role | null; roles: Role[]; mustChangePassword?: boolean; whatsapp?: string };
}

function buildSession(fbUser: any, me: Awaited<ReturnType<typeof fetchMe>>): SessionUser {
  return {
    uid: fbUser.uid,
    email: me.email,
    name: fbUser.displayName || me.name || me.email.split("@")[0],
    photoURL: fbUser.photoURL || me.photoURL || "",
    role: me.role,
    roles: me.roles || (me.role ? [me.role] : []),
    mustChangePassword: me.mustChangePassword,
    authProvider: resolveAuthProvider(fbUser),
    providers: (fbUser?.providerData || []).map((p: any) => p?.providerId),
    whatsapp: me.whatsapp,
  };
}

export interface AuthStrategy {
  execute(): Promise<SessionUser>;
}

export class GoogleStrategy implements AuthStrategy {
  async execute() {
    const auth = await getFirebaseAuth();
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    const token = await result.user.getIdToken();
    return buildSession(result.user, await fetchMe(token));
  }
}

export class MicrosoftStrategy implements AuthStrategy {
  async execute() {
    const auth = await getFirebaseAuth();
    const result = await signInWithPopup(auth, microsoftProvider());
    const token = await result.user.getIdToken();
    return buildSession(result.user, await fetchMe(token));
  }
}

export class EmailStrategy implements AuthStrategy {
  constructor(private email: string, private password: string) {}
  async execute() {
    const auth = await getFirebaseAuth();
    const result = await signInWithEmailAndPassword(auth, this.email, this.password);
    const token = await result.user.getIdToken();
    return buildSession(result.user, await fetchMe(token));
  }
}

// Obtiene un token fresco del usuario actual (para llamadas autenticadas a la API).
export async function getIdToken(): Promise<string | null> {
  const auth = await getFirebaseAuth();
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}
