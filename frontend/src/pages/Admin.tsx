/**
 * Admin.tsx — Admin panel · dark charcoal / cyan theme.
 *
 * Shows all users and all tasks system-wide.
 * Protected client-side (redirects non-admins) + server-side (require_admin → 403).
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, Circle, Clock,
  LogOut, ShieldCheck, Terminal, Users,
} from "lucide-react";
import { getAdminTasks, getAdminUsers, type AuthUser, type Task } from "../api";
import { useAuth } from "../AuthContext";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending:     { label: "pending",     cls: "badge-pending"     },
  in_progress: { label: "in_progress", cls: "badge-in-progress" },
  done:        { label: "done",        cls: "badge-done"        },
};

function Spinner() {
  return (
    // Spinner also masks Render's cold-start delay during admin data fetch
    <div className="flex items-center justify-center h-40">
      <svg className="animate-spin h-5 w-5 text-accent-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
  );
}

export default function Admin() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers]     = useState<AuthUser[]>([]);
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  // Client-side guard — backend will also enforce require_admin
  useEffect(() => {
    if (user && user.role !== "admin") navigate("/dashboard");
  }, [user, navigate]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    Promise.all([getAdminUsers(), getAdminTasks()])
      .then(([u, t]) => { setUsers(u); setTasks(t); })
      .catch(() => setError("Failed to load admin data. Check your session."))
      .finally(() => setLoading(false));
  }, [user]);

  const userMap = Object.fromEntries(users.map((u) => [u.id, u.email]));

  return (
    <div className="min-h-screen bg-charcoal-950 text-charcoal-200">

      {/* Navbar */}
      <header className="bg-charcoal-900 border-b border-charcoal-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-charcoal-800 border border-charcoal-600 rounded-lg p-1.5">
            <Terminal className="w-4 h-4 text-accent-400" />
          </div>
          <span className="font-bold text-charcoal-50 tracking-tight">TaskPilot</span>
          <span className="badge-admin flex items-center gap-1 ml-1">
            <ShieldCheck className="w-3 h-3" /> admin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="btn-ghost text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </button>
          <button onClick={() => { logout(); navigate("/"); }} className="btn-ghost text-xs text-red-500 hover:text-red-400">
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8">

        {error && (
          <div className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-xl px-4 py-3 font-code">
            ⚠ {error}
          </div>
        )}

        {/* Users table */}
        <section>
          <h2 className="text-sm font-semibold text-charcoal-100 mb-4 flex items-center gap-2 font-code">
            <Users className="w-4 h-4 text-accent-400" />
            users
            <span className="bg-charcoal-800 border border-charcoal-700 text-charcoal-500 text-xs px-1.5 py-0.5 rounded font-code">
              {users.length}
            </span>
          </h2>
          {loading ? <Spinner /> : (
            <div className="bg-charcoal-900 border border-charcoal-700 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-charcoal-700 bg-charcoal-800/50">
                  <tr>
                    {["id", "email", "role", "tasks"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-charcoal-500 font-code uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal-800">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-charcoal-800/40 transition-colors">
                      <td className="px-5 py-3 text-charcoal-600 font-code text-xs">#{u.id}</td>
                      <td className="px-5 py-3 text-charcoal-100 font-medium">{u.email}</td>
                      <td className="px-5 py-3">
                        <span className={u.role === "admin" ? "badge-admin" : "badge-user"}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-charcoal-500 font-code text-xs">
                        {tasks.filter((t) => t.user_id === u.id).length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Tasks table */}
        <section>
          <h2 className="text-sm font-semibold text-charcoal-100 mb-4 flex items-center gap-2 font-code">
            <CheckCircle2 className="w-4 h-4 text-accent-400" />
            all_tasks
            <span className="bg-charcoal-800 border border-charcoal-700 text-charcoal-500 text-xs px-1.5 py-0.5 rounded font-code">
              {tasks.length}
            </span>
          </h2>
          {loading ? <Spinner /> : (
            <div className="bg-charcoal-900 border border-charcoal-700 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-charcoal-700 bg-charcoal-800/50">
                  <tr>
                    {["id", "title", "status", "owner"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-charcoal-500 font-code uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal-800">
                  {tasks.map((t) => {
                    const s = STATUS[t.status] ?? STATUS.pending;
                    const StatusIcon = t.status === "done" ? CheckCircle2 : t.status === "in_progress" ? Clock : Circle;
                    return (
                      <tr key={t.id} className="hover:bg-charcoal-800/40 transition-colors">
                        <td className="px-5 py-3 text-charcoal-600 font-code text-xs">#{t.id}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-start gap-2">
                            <StatusIcon className="w-3.5 h-3.5 mt-0.5 text-charcoal-600 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-charcoal-100">{t.title}</p>
                              {t.description && (
                                <p className="text-xs text-charcoal-600 mt-0.5 line-clamp-1">{t.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={s.cls}>{s.label}</span>
                        </td>
                        <td className="px-5 py-3 text-charcoal-500 font-code text-xs">
                          {userMap[t.user_id] ?? `user#${t.user_id}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
