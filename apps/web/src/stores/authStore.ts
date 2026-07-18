import { create } from "zustand";
import type { AuthResult, User } from "../types/api";

// if you change this key, existing sessions get logged out (fine for local)
const STORAGE_KEY = "codearena.auth";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (auth: AuthResult) => void;
  logout: () => void;
}

function loadFromStorage(): Pick<AuthState, "user" | "accessToken" | "refreshToken"> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { user: null, accessToken: null, refreshToken: null };
    }
    const parsed = JSON.parse(raw) as {
      user?: User | null;
      accessToken?: string | null;
      refreshToken?: string | null;
    };
    return {
      user: parsed.user ?? null,
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null
    };
  } catch {
    // bad json from an old build — start clean
    return { user: null, accessToken: null, refreshToken: null };
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadFromStorage(),

  setAuth: (auth) => {
    const next = {
      user: auth.user,
      accessToken: auth.tokens.accessToken,
      refreshToken: auth.tokens.refreshToken
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    set(next);
  },

  logout: () => {
    window.localStorage.removeItem(STORAGE_KEY);
    set({
      user: null,
      accessToken: null,
      refreshToken: null
    });
  }
}));
