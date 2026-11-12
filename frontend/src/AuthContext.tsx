/**
 * AuthContext.tsx — Global authentication state.
 *
 * Wraps the whole app so any component can call useAuth() to get:
 *   user   — the logged-in AuthUser object (or null)
 *   login  — stores the token + user and updates state
 *   logout — clears localStorage and resets state
 *
 * On first render it calls GET /auth/me with any existing token to restore
 * the session after a page reload (so the user stays logged in).
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getMeApi, type AuthUser } from "./api";

// ── Context shape ────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean; // true while /auth/me is in-flight on first load
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // loading=true prevents a flash of the login page on page reload
  const [loading, setLoading] = useState(true);

  // On mount: if a token is in localStorage, validate it with the backend
  // and restore the user object so we don't force a fresh login after refresh.
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    getMeApi()
      .then(setUser)
      .catch(() => {
        // Token is invalid or expired — clear it silently.
        localStorage.removeItem("token");
      })
      .finally(() => setLoading(false));
  }, []);

  function login(token: string, userData: AuthUser) {
    localStorage.setItem("token", token);
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
