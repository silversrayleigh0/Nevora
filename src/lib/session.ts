// Sign-in and keeping the store in sync with Firestore.
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import type { Account, Application } from "../../shared/types";
import { useApp, type AppState } from "../store/app";
import { auth, db, firebaseConfigured } from "./firebase";
import { normalizeInsights, normalizeProfile } from "./normalize";

/** Left over from the retired demo account; removed on startup. */
const LEGACY_DEMO_KEY = "nevora-demo-v1";

// ---------- Auth ----------

const AUTH_ERRORS: Record<string, string> = {
  "auth/invalid-credential": "That email and password don't match. Try again.",
  "auth/wrong-password": "That email and password don't match. Try again.",
  "auth/user-not-found": "There's no account with that email. Create one instead.",
  "auth/email-already-in-use": "An account with that email already exists. Sign in instead.",
  "auth/weak-password": "Use at least 6 characters for your password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Wait a minute, then try again.",
  "auth/network-request-failed": "Couldn't reach the server. Check your connection.",
  "auth/configuration-not-found": "Sign-in isn't switched on for this app yet.",
  "auth/operation-not-allowed": "This sign-in method isn't switched on yet. Try another one.",
  "auth/unauthorized-domain": "Sign-in isn't allowed from this web address yet.",
  "auth/popup-closed-by-user": "",
  "auth/cancelled-popup-request": "",
};

export function authMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  return code in AUTH_ERRORS ? AUTH_ERRORS[code] : "Something went wrong signing in. Try again.";
}

function requireAuth() {
  if (!auth) throw Object.assign(new Error("Sign-in isn't set up yet."), { code: "app/not-configured" });
  return auth;
}

export async function signInEmail(email: string, password: string) {
  await signInWithEmailAndPassword(requireAuth(), email, password);
}

export async function signUpEmail(email: string, password: string) {
  await createUserWithEmailAndPassword(requireAuth(), email, password);
}

export async function signInGoogle() {
  const a = requireAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(a, provider);
  } catch (err) {
    if ((err as { code?: string }).code === "auth/popup-blocked") await signInWithRedirect(a, provider);
    else throw err;
  }
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(requireAuth(), email);
}

export async function signOut() {
  if (useApp.getState().mode === "cloud" && auth) {
    await flushNow();
    await fbSignOut(auth);
  }
  resetStore("signedOut");
}

/** The bearer token the AI endpoint checks. */
export async function idToken(): Promise<string | null> {
  return auth?.currentUser ? auth.currentUser.getIdToken() : null;
}

function resetStore(mode: AppState["mode"]) {
  useApp.setState({ mode, uid: null, account: null, profile: null, insights: null, applications: [], activeId: null, saveState: "idle", loadError: null });
}

// ---------- Firestore sync ----------

const userDoc = (uid: string) => doc(db!, "users", uid);
const appDoc = (uid: string, id: string) => doc(db!, "users", uid, "applications", id);

/** Firestore rejects `undefined`; a JSON round-trip drops those fields. */
const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const defaultAccount = (user: User): Account => ({
  name: user.displayName ?? "",
  email: user.email ?? "",
  phone: user.phoneNumber ?? "",
  city: "",
  status: "student",
  gradYear: "",
  interests: [],
});

async function loadUser(user: User) {
  useApp.setState({ mode: "loading", loadError: null });
  try {
    const [snap, apps] = await Promise.all([getDoc(userDoc(user.uid)), getDocs(collection(db!, "users", user.uid, "applications"))]);
    const data = snap.data() ?? {};
    const applications = apps.docs.map((d) => d.data() as Application).sort((a, b) => b.updatedAt - a.updatedAt);
    const activeId = useApp.getState().activeId;
    useApp.setState({
      mode: "cloud",
      uid: user.uid,
      account: (data.account as Account | undefined) ?? defaultAccount(user),
      profile: data.profile ? normalizeProfile(data.profile) : null,
      insights: data.insights ? normalizeInsights(data.insights) : null,
      applications,
      activeId: applications.some((a) => a.id === activeId) ? activeId : null,
      saveState: "saved",
      loadError: null,
    });
  } catch (err) {
    // Never fall through to an empty profile: saving it would overwrite real data.
    console.error("[session] couldn't load your data", err);
    useApp.setState({
      mode: "cloud",
      uid: user.uid,
      account: null,
      profile: null,
      insights: null,
      applications: [],
      saveState: "error",
      loadError: "We couldn’t load your profile. Check your connection, then try again.",
    });
  }
}

/** Retry after a failed load. */
export function retryLoad() {
  if (auth?.currentUser) void loadUser(auth.currentUser);
}

let userDirty = false;
const dirtyApps = new Set<string>();
const deletedApps = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> | null = null;

async function flush() {
  const s = useApp.getState();
  if (s.mode !== "cloud" || !s.uid || !db || s.loadError) return;
  const uid = s.uid;
  const writes: Promise<unknown>[] = [];
  if (userDirty) {
    userDirty = false;
    writes.push(setDoc(userDoc(uid), clean({ account: s.account, profile: s.profile, insights: s.insights, updatedAt: Date.now() }), { merge: true }));
  }
  for (const id of dirtyApps) {
    const app = s.applications.find((a) => a.id === id);
    if (app) writes.push(setDoc(appDoc(uid, id), clean(app)));
  }
  dirtyApps.clear();
  for (const id of deletedApps) writes.push(deleteDoc(appDoc(uid, id)));
  deletedApps.clear();
  if (!writes.length) return;
  useApp.setState({ saveState: navigator.onLine ? "saving" : "offline" });
  try {
    await Promise.all(writes);
    useApp.setState({ saveState: "saved" });
  } catch (err) {
    console.error("[session] save failed", err);
    useApp.setState({ saveState: "error" });
  }
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    flushing = flush().finally(() => (flushing = null));
  }, 700);
}

async function flushNow() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    await flush();
  }
  await flushing;
}

function watchStore() {
  useApp.subscribe((s, prev) => {
    if (s.mode !== "cloud" || prev.mode !== "cloud" || s.uid !== prev.uid || s.loadError) return;
    if (s.account !== prev.account || s.profile !== prev.profile || s.insights !== prev.insights) userDirty = true;
    if (s.applications !== prev.applications) {
      const before = new Map(prev.applications.map((a) => [a.id, a]));
      for (const a of s.applications) if (before.get(a.id) !== a) dirtyApps.add(a.id);
      for (const a of prev.applications) if (!s.applications.some((x) => x.id === a.id)) deletedApps.add(a.id);
    }
    if (userDirty || dirtyApps.size || deletedApps.size) schedule();
  });
  window.addEventListener("pagehide", () => void flushNow());
}

/** Called once at startup. */
export function initSession() {
  try {
    localStorage.removeItem(LEGACY_DEMO_KEY);
  } catch {
    /* storage blocked */
  }
  watchStore();
  if (!firebaseConfigured || !auth) {
    resetStore("signedOut");
    return;
  }
  onAuthStateChanged(auth, (user) => {
    if (user) void loadUser(user);
    else resetStore("signedOut");
  });
}
