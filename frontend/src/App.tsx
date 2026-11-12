/**
 * App.tsx — Root component: routing + auth gating.
 *
 * Route structure:
 *   /           → Auth (login/signup)
 *   /dashboard  → Dashboard (authenticated users)
 *   /admin      → Admin (role === 'admin' only)
 *   *           → redirect to /
 *
 * ProtectedRoute checks the auth state before rendering any child route.
 * While the initial /auth/me call is in-flight (restoring session on reload),
 * a full-screen spinner is shown so there's no flash of the login page.
 */

import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import { Zap } from "lucide-react";
import type { ReactNode } from "react";

// ── Full-screen loading spinner ───────────────────────────────────────────────
// Shown while AuthContext restores session from localStorage + /auth/me call.
// Also provides a graceful wait screen during Render's cold-start (free tier
// can take up to ~60s to wake — users see a branded spinner, not a blank page).
function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex flex-col items-center justify-center gap-4">
      <div className="bg-purple-600 rounded-2xl p-3 shadow-lg">
        <Zap className="w-8 h-8 text-white" />
      </div>
      <svg className="animate-spin h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
      <p className="text-sm text-gray-400">Starting TaskPilot…</p>
    </div>
  );
}

// ── Route guard: redirect to login if not authenticated ───────────────────────
function ProtectedRoute({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();

  // Wait for session restore before making any routing decision.
  // This prevents the page from flashing to /login on a hard refresh.
  if (loading) return <FullScreenLoader />;

  if (!user) return <Navigate to="/" replace />;

  // Admin-only guard: bounce regular users to their dashboard
  if (adminOnly && user.role !== "admin") return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public */}
          <Route path="/" element={<AuthGate />} />

          {/* User dashboard — any authenticated user */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin panel — only role === 'admin' */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <Admin />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

/**
 * AuthGate: if already logged in, redirect away from the login page.
 * Admins go to /admin, users go to /dashboard.
 */
function AuthGate() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  return <Auth />;
}
