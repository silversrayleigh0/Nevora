import { create } from "zustand";
import { normalizeLinkedInUrl, type FoundLinkedIn } from "../lib/linkedinUrl";

/**
 * Setup-only state that must not reach the profile until the user confirms it:
 * the LinkedIn URL found in the uploaded resume. Kept for this browser tab only,
 * so a reload on step 4 still shows it.
 */
const KEY = "nevora-setup-linkedin";

const read = (): FoundLinkedIn | null => {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Partial<FoundLinkedIn> | null;
    const url = v?.url ? normalizeLinkedInUrl(v.url) : null;
    return url ? { url, source: v?.source === "hyperlink" ? "hyperlink" : "text" } : null;
  } catch {
    return null;
  }
};

export const useSetup = create<{ foundLinkedIn: FoundLinkedIn | null; setFoundLinkedIn: (found: FoundLinkedIn | null) => void }>()((set) => ({
  foundLinkedIn: read(),
  setFoundLinkedIn: (found) => {
    try {
      if (found) sessionStorage.setItem(KEY, JSON.stringify(found));
      else sessionStorage.removeItem(KEY);
    } catch {
      /* storage can be blocked; the found URL just won't survive a reload */
    }
    set({ foundLinkedIn: found });
  },
}));
