/**
 * Auth.tsx — Login & Signup page.
 *
 * Quick-fill buttons let the evaluator test both roles instantly without typing.
 * Tailwind's form styles keep it clean and readable on mobile + desktop.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus, Zap } from "lucide-react";
import { loginApi, signupApi, getMeApi } from "../api";
import { useAuth } from "../AuthContext";

type Mode = "login" | "signup";

// Quick-fill presets for the evaluator — saves typing during demo
const DEMO_ACCOUNTS = [
  {
    label: "Fill Demo Admin",
    email: "admin@taskpilot.com",
    password: "Admin@123",
    color: "bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-300",
  },
  {
    label: "Fill Demo User",
    email: "user@taskpilot.com",
    password: "User@123",
    color: "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-300",
  },
];

export default function Auth() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res =
        mode === "login"
          ? await loginApi(email, password)
          : await signupApi(email, password);

      // Store token then fetch the full user profile (id + role)
      localStorage.setItem("token", res.access_token);
      const me = await getMeApi();
      login(res.access_token, me);

      // Redirect admin → admin panel, users → dashboard
      navigate(me.role === "admin" ? "/admin" : "/dashboard");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-600 mb-4 shadow-lg">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">TaskPilot</h1>
          <p className="text-gray-500 mt-1 text-sm">AI-powered task management</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* ── Quick-fill buttons (evaluator convenience) ─────────────────── */}
          {mode === "login" && (
            <div className="mb-6">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-2">
                Quick fill for evaluators
              </p>
              <div className="flex gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email);
                      setPassword(acc.password);
                      setError("");
                    }}
                    className={`flex-1 text-xs font-medium py-2 px-3 rounded-lg border transition-colors ${acc.color}`}
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Mode tabs ─────────────────────────────────────────────────── */}
          <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
            {(["login", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
                  mode === m
                    ? "bg-white shadow text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {m === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* ── Form ──────────────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  {/* Spinner — also masks Render's cold-start delay (up to ~60s on free tier) */}
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  {mode === "login" ? "Signing in…" : "Creating account…"}
                </>
              ) : mode === "login" ? (
                <><LogIn className="w-4 h-4" /> Sign In</>
              ) : (
                <><UserPlus className="w-4 h-4" /> Create Account</>
              )}
            </button>
          </form>

          {mode === "signup" && (
            <p className="mt-4 text-xs text-center text-gray-400">
              New accounts are created with the <strong>user</strong> role.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
