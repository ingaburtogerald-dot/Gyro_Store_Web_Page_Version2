// Firebase SDK del cliente (solo navegador). La config se obtiene del servidor
// vía GET /api/auth/config para no hornear secretos en el bundle.
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  linkWithPopup,
  type Auth,
} from "firebase/auth";

let authInstance: Auth | null = null;

export async function getFirebaseAuth(): Promise<Auth> {
  if (authInstance) return authInstance;

  const res = await fetch("/api/auth/config");
  const fbConfig = await res.json();
  if (!fbConfig.configured) {
    throw new Error("Firebase no está configurado en el servidor.");
  }

  const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(fbConfig);
  authInstance = getAuth(app);
  return authInstance;
}

// Provider de Microsoft (Hotmail/Outlook) vía OAuth de Firebase.
export function microsoftProvider(): OAuthProvider {
  const provider = new OAuthProvider("microsoft.com");
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

export {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  linkWithPopup,
};
