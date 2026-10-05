// Sign-in and keeping the store in sync with Firestore.
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
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
import type { Account, Application, Insights, Profile } from "../../shared/types";
import { useApp, type AppState } from "../store/app";
import { auth, db, firebaseConfigured } from "./firebase";
import { normalizeInsights, normalizeProfile } from "./normalize";

/** Left over from the retired demo account; removed on startup. */
const LEGACY_DEMO_KEY = "nevora-demo-v1";

// ---------- Auth ----------

const AUTH_ERRORS: Record<string, string> = {
  "auth/invalid-credential": "That email and password don't match. If you signed up with Google, use Continue with Google.",
  "auth/wrong-password": "That email and password don't match. If you signed up with Google, use Continue with Google.",
  "auth/user-not-found": "There's no account with that email. Create one instead.",
  "auth/email-already-in-use": "An account with that email already exists. Sign in instead, or use Continue with Google.",
  "auth/account-exists-with-different-credential": "This email already has an account. Sign in with your email and password instead.",
  "auth/missing-password": "Enter your password.",
  "auth/user-disabled": "This account has been turned off. Contact support for help.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site, then try again.",
  "auth/internal-error": "Sign-in hit a problem. Try again in a moment.",
  "auth/weak-password": "Use at least 6 characters for your password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Wait a minute, then try again.",
  "auth/network-request-failed": "Couldn't reach the server. Check your connection.",
  "auth/configuration-not-found": "Sign-in isn't switched on for this app yet.",
  "auth/operation-not-allowed": "This sign-in method isn't switched on yet. Try another one.",
  "auth/web-storage-unsupported": "Your browser is blocking storage this site needs. Turn off private mode or allow cookies, then try again.",
  "auth/timeout": "Sign-in took too long. Check your connection and try again.",
  "auth/unauthorized-domain": "Google sign-in isn't switched on for this website yet. Use your email and password for now.",
  "auth/popup-closed-by-user": "",
  "auth/cancelled-popup-request": "",
};

export function authMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  if (code && code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") console.warn("[auth]", code, err);
  return code in AUTH_ERRORS ? AUTH_ERRORS[code] : "Something went wrong signing in. Try again.";
}

export const authCode = (err: unknown) => (err as { code?: string })?.code ?? "";

/** Surfaces errors from a Google sign-in that fell back to a full-page redirect. */
export async function redirectError(): Promise<unknown | null> {
  if (!auth) return null;
  try {
    await getRedirectResult(auth);
    return null;
  } catch (err) {
    return err;
  }
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
  const { mode, uid } = useApp.getState();
  if (mode === "cloud" && auth) {
    await flushNow();
    // On shared computers, don't leave a copy behind unless it holds work not yet in the cloud.
    if (uid && !readDevice(uid)?.pending) {
      try {
        localStorage.removeItem(deviceKey(uid));
      } catch {
        /* storage blocked */
      }
    }
    await fbSignOut(auth);
  }
  resetStore("signedOut");
}

/** The bearer token the AI endpoint checks. */
export async function idToken(): Promise<string | null> {
  return auth?.currentUser ? auth.currentUser.getIdToken() : null;
}

function resetStore(mode: AppState["mode"]) {
  useApp.setState({ mode, uid: null, account: null, profile: null, insights: null, applications: [], activeId: null, saveState: "idle", sync: "cloud", loadError: null });
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

const LOAD_TIMEOUT_MS = 10_000;

// ---------- Device copy ----------
// Every signed-in change is also kept in this browser. If cloud storage is down,
// the app keeps working from this copy and uploads it once the cloud is back.

type DeviceCopy = {
  account: Account | null;
  profile: Profile | null;
  insights: Insights | null;
  applications: Application[];
  savedAt: number;
  /** True when changes were made while the cloud was unreachable. */
  pending: boolean;
};

const deviceKey = (uid: string) => `nevora-device-v1:${uid}`;

function readDevice(uid: string): DeviceCopy | null {
  try {
    const raw = localStorage.getItem(deviceKey(uid));
    return raw ? (JSON.parse(raw) as DeviceCopy) : null;
  } catch {
    return null;
  }
}

function writeDevice(uid: string, pending: boolean) {
  const s = useApp.getState();
  const previous = readDevice(uid);
  const copy: DeviceCopy = {
    account: s.account,
    profile: s.profile,
    insights: s.insights,
    applications: s.applications,
    savedAt: Date.now(),
    pending: pending || Boolean(previous?.pending && s.sync === "device"),
  };
  try {
    localStorage.setItem(deviceKey(uid), JSON.stringify(copy));
  } catch {
    /* storage full or blocked */
  }
}

function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error("load timed out"), { code: "timeout" })), LOAD_TIMEOUT_MS);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

async function loadUser(user: User) {
  useApp.setState({ mode: "loading", loadError: null });
  const device = readDevice(user.uid);
  const activeId = useApp.getState().activeId;
  try {
    const [snap, apps] = await withTimeout(
      Promise.all([getDoc(userDoc(user.uid)), getDocs(collection(db!, "users", user.uid, "applications"))]),
    );
    const data = snap.data() ?? {};
    let account = (data.account as Account | undefined) ?? null;
    let profile = data.profile ? normalizeProfile(data.profile) : null;
    let insights = data.insights ? normalizeInsights(data.insights) : null;
    const cloudApps = apps.docs.map((d) => d.data() as Application);
    const upload = { user: false, apps: [] as string[] };

    // Work saved on this device while the cloud was down gets uploaded now.
    // The cloud profile always wins if it exists, so nothing real is overwritten.
    if (device?.pending) {
      if (!profile && device.profile) {
        account = device.account ?? account;
        profile = normalizeProfile(device.profile);
        insights = device.insights ?? insights;
        upload.user = true;
      }
      for (const app of device.applications) {
        const cloud = cloudApps.find((a) => a.id === app.id);
        if (!cloud || app.updatedAt > cloud.updatedAt) {
          if (cloud) cloudApps.splice(cloudApps.indexOf(cloud), 1);
          cloudApps.push(app);
          upload.apps.push(app.id);
        }
      }
    }
    const applications = cloudApps.sort((a, b) => b.updatedAt - a.updatedAt);
    useApp.setState({
      mode: "cloud",
      uid: user.uid,
      account: account ?? defaultAccount(user),
      profile,
      insights,
      applications,
      activeId: applications.some((a) => a.id === activeId) ? activeId : null,
      saveState: "saved",
      sync: "cloud",
      loadError: null,
    });
    if (upload.user) userDirty = true;
    upload.apps.forEach((id) => dirtyApps.add(id));
    if (upload.user || upload.apps.length) schedule();
    else writeDevice(user.uid, false);
  } catch (err) {
    // Keep working from this device instead of blocking. Nothing is written to the
    // cloud in this state, so real cloud data can't be overwritten.
    console.error("[session] cloud storage unavailable; using this device", err);
    const applications = device?.applications ?? [];
    useApp.setState({
      mode: "cloud",
      uid: user.uid,
      account: device?.account ?? defaultAccount(user),
      profile: device?.profile ? normalizeProfile(device.profile) : null,
      insights: device?.insights ?? null,
      applications,
      activeId: applications.some((a) => a.id === activeId) ? activeId : null,
      saveState: "saved",
      sync: "device",
      loadError: null,
    });
  }
}

/** Try the cloud again (after it was unreachable). */
export function retryLoad() {
  const user = auth?.currentUser;
  if (!user) return;
  const s = useApp.getState();
  // Make sure the latest device work is on disk before reloading.
  if (s.uid === user.uid && s.mode === "cloud") writeDevice(user.uid, s.sync === "device");
  void loadUser(user);
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
  if (s.sync === "device") {
    writeDevice(uid, true);
    userDirty = false;
    dirtyApps.clear();
    deletedApps.clear();
    return;
  }
  writeDevice(uid, false);
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
    writeDevice(uid, false);
  } catch (err) {
    console.error("[session] save failed", err);
    // Keep the work on this device and upload it next time the cloud is reachable.
    writeDevice(uid, true);
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
