import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import {
  GoogleAuthProvider,
  OAuthProvider,
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  type Auth,
  type UserCredential,
} from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, initializeFirestore, memoryLocalCache, type Firestore } from "firebase/firestore";

export const AUTH_PROVIDER_IDS = { google: "google.com", microsoft: "microsoft.com" } as const;
export type AuthProviderName = keyof typeof AUTH_PROVIDER_IDS;

export type FirebasePublicConfig = FirebaseOptions & {
  authGoogleEnabled: boolean;
  authMicrosoftEnabled: boolean;
  authMicrosoftVisible: boolean;
  useEmulators: boolean;
};

export type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  config: FirebasePublicConfig;
};

let services: FirebaseServices | null = null;
let emulatorsConnected = false;

function bool(value: string | undefined): boolean {
  return value === "true";
}

export function readFirebasePublicConfig(environment: Record<string, string | boolean | undefined>): FirebasePublicConfig | null {
  const apiKey = environment.VITE_FIREBASE_API_KEY;
  const authDomain = environment.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = environment.VITE_FIREBASE_PROJECT_ID;
  const appId = environment.VITE_FIREBASE_APP_ID;
  const messagingSenderId = environment.VITE_FIREBASE_MESSAGING_SENDER_ID;
  if (typeof apiKey !== "string" || typeof authDomain !== "string" || typeof projectId !== "string" || typeof appId !== "string" || typeof messagingSenderId !== "string") return null;
  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    messagingSenderId,
    storageBucket: typeof environment.VITE_FIREBASE_STORAGE_BUCKET === "string" ? environment.VITE_FIREBASE_STORAGE_BUCKET : undefined,
    authGoogleEnabled: bool(String(environment.VITE_FIREBASE_AUTH_GOOGLE_ENABLED ?? "false")),
    authMicrosoftEnabled: bool(String(environment.VITE_FIREBASE_AUTH_MICROSOFT_ENABLED ?? "false")),
    authMicrosoftVisible: bool(String(environment.VITE_FIREBASE_AUTH_MICROSOFT_VISIBLE ?? "false")),
    useEmulators: bool(String(environment.VITE_USE_FIREBASE_EMULATORS ?? "false")),
  };
}

export function getFirebaseServices(): FirebaseServices | null {
  if (services) return services;
  const environment = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env ?? {};
  const config = readFirebasePublicConfig(environment);
  if (!config) return null;
  const app = getApps().length ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  const db = getApps().length > 1
    ? getFirestore(app)
    : initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: memoryLocalCache() });
  void setPersistence(auth, browserLocalPersistence);
  if (config.useEmulators && !emulatorsConnected) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    emulatorsConnected = true;
  }
  services = { app, auth, db, config };
  return services;
}

export async function signInWithProvider(providerName: AuthProviderName): Promise<UserCredential | void> {
  const current = getFirebaseServices();
  if (!current) throw new Error("Cloud sign-in is not configured for this build.");
  if (providerName === "google" && !current.config.authGoogleEnabled) throw new Error("Google sign-in is not enabled yet.");
  if (providerName === "microsoft" && !current.config.authMicrosoftEnabled) throw new Error("Microsoft sign-in is not enabled yet.");
  const provider = providerName === "google" ? new GoogleAuthProvider() : new OAuthProvider(AUTH_PROVIDER_IDS.microsoft);
  provider.setCustomParameters({ prompt: "select_account" });
  if (window.matchMedia("(max-width: 820px)").matches) return signInWithRedirect(current.auth, provider);
  return signInWithPopup(current.auth, provider);
}

export function resetFirebaseClientForTests() {
  services = null;
  emulatorsConnected = false;
}
