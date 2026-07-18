import { create } from "zustand";

const THEME_KEY = "codearena.theme";

interface UiState {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

function readInitialDarkMode(): boolean {
  // default to dark unless user explicitly picked light
  const saved = window.localStorage.getItem(THEME_KEY);
  if (saved === "light") {
    return false;
  }
  return true;
}

export const useUiStore = create<UiState>((set, get) => ({
  darkMode: readInitialDarkMode(),

  toggleDarkMode: () => {
    const next = !get().darkMode;
    if (next) {
      window.localStorage.setItem(THEME_KEY, "dark");
    } else {
      window.localStorage.setItem(THEME_KEY, "light");
    }
    document.documentElement.classList.toggle("dark", next);
    set({ darkMode: next });
  }
}));
