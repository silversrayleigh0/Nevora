import { create } from "zustand";
import type { Account, Application, Insights, Profile } from "../../shared/types";

/**
 * loading   – waiting for Firebase to report the session
 * signedOut – nobody signed in
 * cloud     – signed in; changes sync to Firestore
 * demo      – sample account kept in this browser only
 */
export type Mode = "loading" | "signedOut" | "cloud" | "demo";
export type SaveState = "idle" | "saving" | "saved" | "offline" | "error";

export type AppState = {
  mode: Mode;
  uid: string | null;
  account: Account | null;
  profile: Profile | null;
  insights: Insights | null;
  applications: Application[];
  activeId: string | null;
  saveState: SaveState;

  setAccount: (account: Account) => void;
  setProfile: (profile: Profile) => void;
  setInsights: (insights: Insights | null) => void;
  newApplication: () => string;
  updateApplication: (id: string, patch: Partial<Application>) => void;
  deleteApplication: (id: string) => void;
  restoreApplication: (app: Application) => void;
  duplicateApplication: (id: string) => void;
  setActive: (id: string | null) => void;
};

export const newId = (prefix = "id") => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;

const ACTIVE_KEY = "nevora-active";
const readActive = () => {
  try {
    return sessionStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
};

export const useApp = create<AppState>()((set, get) => ({
  mode: "loading",
  uid: null,
  account: null,
  profile: null,
  insights: null,
  applications: [],
  activeId: readActive(),
  saveState: "idle",

  setAccount: (account) => set({ account }),
  setProfile: (profile) => set({ profile }),
  setInsights: (insights) => set({ insights }),
  newApplication: () => {
    const id = newId("app");
    const now = Date.now();
    const app: Application = {
      id,
      name: "Untitled resume",
      createdAt: now,
      updatedAt: now,
      jdText: "",
      jd: null,
      match: null,
      resume: null,
      verifications: null,
      plan: null,
      planDone: {},
      hiddenSections: [],
      coverLetter: null,
      interview: null,
    };
    set((s) => ({ applications: [app, ...s.applications], activeId: id }));
    return id;
  },
  updateApplication: (id, patch) =>
    set((s) => ({ applications: s.applications.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a)) })),
  deleteApplication: (id) =>
    set((s) => ({ applications: s.applications.filter((a) => a.id !== id), activeId: s.activeId === id ? null : s.activeId })),
  restoreApplication: (app) =>
    set((s) => ({ applications: s.applications.some((a) => a.id === app.id) ? s.applications : [app, ...s.applications] })),
  duplicateApplication: (id) => {
    const source = get().applications.find((a) => a.id === id);
    if (!source) return;
    const now = Date.now();
    const copy: Application = { ...structuredClone(source), id: newId("app"), name: `${source.name} (copy)`, createdAt: now, updatedAt: now };
    set((s) => ({ applications: [copy, ...s.applications] }));
  },
  setActive: (id) => set({ activeId: id }),
}));

useApp.subscribe((s, prev) => {
  if (s.activeId === prev.activeId) return;
  try {
    if (s.activeId) sessionStorage.setItem(ACTIVE_KEY, s.activeId);
    else sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* storage can be blocked; the active resume just won't survive a reload */
  }
});

export const useActiveApplication = () =>
  useApp((s) => s.applications.find((a) => a.id === s.activeId) ?? null);

export const isSignedIn = (mode: Mode) => mode === "cloud" || mode === "demo";
