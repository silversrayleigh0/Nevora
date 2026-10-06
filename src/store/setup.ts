import { create } from "zustand";

/**
 * Setup-only state that must not reach the profile until the user confirms it:
 * the LinkedIn URL found in the uploaded resume. Kept for this browser tab only,
 * so a reload on step 4 still shows it.
 */
const KEY = "nevora-setup-linkedin";

const read = (): string | null => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const useSetup = create<{ foundLinkedIn: string | null; setFoundLinkedIn: (url: string | null) => void }>()((set) => ({
  foundLinkedIn: read(),
  setFoundLinkedIn: (url) => {
    try {
      if (url) sessionStorage.setItem(KEY, url);
      else sessionStorage.removeItem(KEY);
    } catch {
      /* storage can be blocked; the found URL just won't survive a reload */
    }
    set({ foundLinkedIn: url });
  },
}));
