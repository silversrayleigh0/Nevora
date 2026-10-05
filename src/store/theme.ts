import { create } from "zustand";

export type Theme = "light" | "dark";
const KEY = "nevora-theme";

const read = (): Theme => {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};

const apply = (theme: Theme) => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
};

export const useTheme = create<{ theme: Theme; setTheme: (t: Theme) => void; toggle: () => void }>()((set, get) => ({
  theme: read(),
  setTheme: (theme) => {
    apply(theme);
    set({ theme });
  },
  toggle: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));

/** Light is the default; every new sign-in starts in light mode. */
export const resetThemeOnSignIn = () => useTheme.getState().setTheme("light");

apply(useTheme.getState().theme);
