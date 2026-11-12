/**
 * Auth.tsx — Login & Signup · dark charcoal theme.
 *
 * Quick-fill buttons let the evaluator test both roles instantly.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus, Terminal } from "lucide-react";
import { loginApi, signupApi, getMeApi } from "../api";
import { useAuth } from "../AuthContext";

type Mode = "login" | "signup";

const DEMO_ACCOUNTS = [
  {
    label: "Fill Demo Admin",
    email: "admin@taskpilot.com",
    password: "Admin@123",
    cls: "border border-cyan-700/50 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20",
  },
  {
    label: "Fill Demo User",
    email: "user@taskpilot.com",
    password: "User@123",
    cls: "border border-charcoal-600/50 bg-charcoal-800 text-charcoal-300 hover:bg-charcoal-700",
  },
];

function Spinner({ sm = false }: { sm?: boolean }) {
  const s = sm ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <svg className={`animate-spin ${s} text-charcoal-950`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

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
      localStorage.setItem("token", res.access_token);
      const me = await getMeApi();
      login(res.access_token, me);
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
    <div className="min-h-screen bg-charcoal-950 bg-dot-grid flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-charcoal-800 border border-charcoal-700 mb-4 shadow-lg">
            <Terminal className="w-7 h-7 text-accent-400" />
          </div>
          <h1 className="text-3xl font-bold text-charcoal-50 tracking-tight">TaskPilot</h1>
          <p className="text-charcoal-500 mt-1 text-sm font-code">// ai-powered task agent</p>
        </div>

        <div className="bg-charcoal-900 border border-charcoal-700 rounded-2xl shadow-2xl p-8">

          {/* Quick-fill */}
          {mode === "login" && (
            <div className="mb-6">
              <p className="text-xs text-charcoal-500 font-code uppercase tracking-widest mb-2">
                evaluator quick-fill
              </p>
              <div className="flex gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => { setEmail(acc.email); setPassword(acc.password); setError(""); }}
                    className={`flex-1 text-xs font-medium py-2 px-3 rounded-lg transition-colors font-code ${acc.cls}`}
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mode tabs */}
          <div className="flex rounded-xl bg-charcoal-800 border border-charcoal-700 p-1 mb-6">
            {(["login", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all capitalize ${
                  mode === m
                    ? "bg-charcoal-950 text-charcoal-50 shadow border border-charcoal-600"
                    : "text-charcoal-500 hover:text-charcoal-300"
                }`}
              >
                {m === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-charcoal-400 mb-1 font-code uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-dark"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-charcoal-400 mb-1 font-code uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-dark"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2 font-code text-xs">
                ⚠ {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? (
                <><Spinner /> {mode === "login" ? "Signing in…" : "Creating account…"}</>
              ) : mode === "login" ? (
                <><LogIn className="w-4 h-4" /> Sign In</>
              ) : (
                <><UserPlus className="w-4 h-4" /> Create Account</>
              )}
            </button>
          </form>

          {mode === "signup" && (
            <p className="mt-4 text-xs text-center text-charcoal-600 font-code">
              // new accounts receive role: "user"
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
