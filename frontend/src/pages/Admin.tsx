/**
 * Admin.tsx — Admin-only panel.
 *
 * ROUTE PROTECTION: This component checks role === 'admin' before rendering
 * its content. Even if a user somehow navigates here, they'll be redirected.
 * The real enforcement is on the backend: /admin/tasks and /admin/users both
 * require the require_admin dependency and return 403 for non-admins.
 *
 * Shows:
 *   • All users in the system
 *   • All tasks system-wide (with owner info)
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, Circle, Clock,
  LogOut, ShieldCheck, Users, Zap,
} from "lucide-react";
import { getAdminTasks, getAdminUsers, type AuthUser, type Task } from "../api";
import { useAuth } from "../AuthContext";

const STATUS_CONFIG = {
  pending:     { label: "Pending",     icon: Circle,       color: "bg-yellow-100 text-yellow-700" },
  in_progress: { label: "In Progress", icon: Clock,        color: "bg-blue-100 text-blue-700"   },
  done:        { label: "Done",        icon: CheckCircle2, color: "bg-green-100 text-green-700" },
} as const;

function Spinner() {
  return (
    // Spinner shown while fetching from /admin endpoints.
    // On Render's free tier the backend may need ~60s to wake from sleep —
    // this keeps the UI responsive and informative during that wait.
    <div className="flex items-center justify-center h-40">
      <svg className="animate-spin h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
  );
}

export default function Admin() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers]   = useState<AuthUser[]>([]);
  const [tasks, setTasks]   = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  // ── Guard: redirect non-admins immediately ────────────────────────────────
  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // ── Fetch admin data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || user.role !== "admin") return;
    Promise.all([getAdminUsers(), getAdminTasks()])
      .then(([u, t]) => { setUsers(u); setTasks(t); })
      .catch(() => setError("Failed to load admin data. Check your session."))
      .finally(() => setLoading(false));
  }, [user]);

  function handleLogout() { logout(); navigate("/"); }

  // Build a quick lookup: user_id → email for the task table
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.email]));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-purple-600 rounded-lg p-1.5">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg">TaskPilot</span>
          <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Admin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm flex items-center gap-1 text-gray-500 hover:text-purple-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* ── Users table ──────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            All Users
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
              {users.length}
            </span>
          </h2>

          {loading ? <Spinner /> : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">ID</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Email</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Role</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Tasks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-gray-400 font-mono text-xs">#{u.id}</td>
                      <td className="px-5 py-3 text-gray-800 font-medium">{u.email}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                          u.role === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-gray-100 text-gray-600"
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {tasks.filter((t) => t.user_id === u.id).length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Tasks table ──────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-purple-500" />
            All Tasks (System-wide)
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
              {tasks.length}
            </span>
          </h2>

          {loading ? <Spinner /> : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">ID</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Title</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600">Owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tasks.map((t) => {
                    const cfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.pending;
                    return (
                      <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-gray-400 font-mono text-xs">#{t.id}</td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-800">{t.title}</p>
                          {t.description && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{t.description}</p>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-500 text-xs">
                          {userMap[t.user_id] ?? `user #${t.user_id}`}
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
