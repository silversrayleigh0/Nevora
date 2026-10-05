import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from "firebase/firestore";
import { FIREBASE_WEB_CONFIG } from "../../shared/firebaseConfig";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || FIREBASE_WEB_CONFIG.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || FIREBASE_WEB_CONFIG.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || FIREBASE_WEB_CONFIG.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || FIREBASE_WEB_CONFIG.appId,
};

/** False only if a build overrides the config with empty values. */
export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (firebaseConfigured) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
}

export { auth, db };
