/**
 * Dashboard.tsx — Split-screen workspace · dark charcoal / cyan theme.
 *
 * Left:  Task List  — GET /tasks, auto-refreshes after every AI action.
 * Right: AI Chat    — POST /chat, renders tool-call badges in monospace.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2, Circle, Clock, LogOut, RefreshCw,
  Send, Settings, Terminal, Wrench,
} from "lucide-react";
import { getTasks, sendChat, type Task, type ToolCall } from "../api";
import { useAuth } from "../AuthContext";

// ── Status config ────────────────────────────────────────────────────────────

const STATUS: Record<string, { label: string; cls: string; Icon: typeof Circle }> = {
  pending:     { label: "pending",     cls: "badge-pending",     Icon: Circle       },
  in_progress: { label: "in_progress", cls: "badge-in-progress", Icon: Clock        },
  done:        { label: "done",        cls: "badge-done",        Icon: CheckCircle2 },
};

// ── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ cls = "text-accent-500" }: { cls?: string }) {
  return (
    <svg className={`animate-spin h-4 w-4 ${cls}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  tools_called?: ToolCall[];
}

// ── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `> TaskPilot agent ready.\n\nHi ${user?.email?.split("@")[0] ?? "there"} 👋 — try:\n• "Add a task to review the PR"\n• "What tasks are pending?"\n• "Mark my first task as done"`,
    },
  ]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ── Fetch tasks ────────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    try { setTasks(await getTasks()); }
    catch { /* keep stale list */ }
    finally { setTasksLoading(false); }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ───────────────────────────────────────────────────────────

  async function handleSend() {
    const text = input.trim();
    if (!text || chatLoading) return;
    setMessages((p) => [...p, { role: "user", content: text }]);
    setInput("");
    setChatLoading(true);
    try {
      const res = await sendChat(text);
      setMessages((p) => [...p, { role: "assistant", content: res.reply, tools_called: res.tools_called }]);
      // Auto-refresh: agent may have mutated tasks — sync the list immediately
      await fetchTasks();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Agent unavailable. Please try again.";
      setMessages((p) => [...p, { role: "assistant", content: `⚠ ${detail}` }]);
    } finally {
      setChatLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-charcoal-950 flex flex-col text-charcoal-200">

      {/* Navbar */}
      <header className="bg-charcoal-900 border-b border-charcoal-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-charcoal-800 border border-charcoal-600 rounded-lg p-1.5">
            <Terminal className="w-4 h-4 text-accent-400" />
          </div>
          <span className="font-bold text-charcoal-50 tracking-tight">TaskPilot</span>
          <span className="text-charcoal-600 text-xs font-code hidden sm:block">// agent dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-charcoal-500 font-code hidden sm:block">{user?.email}</span>
          <span className={user?.role === "admin" ? "badge-admin" : "badge-user"}>
            {user?.role}
          </span>
          {user?.role === "admin" && (
            <button onClick={() => navigate("/admin")} className="btn-ghost text-xs">
              <Settings className="w-3.5 h-3.5" /> Admin
            </button>
          )}
          <button onClick={() => { logout(); navigate("/"); }} className="btn-ghost text-xs text-red-500 hover:text-red-400">
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 53px)" }}>

        {/* ════ LEFT: Task List ════ */}
        <aside className="w-80 xl:w-96 bg-charcoal-900 border-r border-charcoal-700 flex flex-col">
          <div className="px-4 py-3 border-b border-charcoal-700/60 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-charcoal-100 flex items-center gap-2 font-code">
              tasks
              <span className="bg-charcoal-800 border border-charcoal-600 text-charcoal-400 text-xs px-1.5 py-0.5 rounded font-code">
                {tasks.length}
              </span>
            </h2>
            <button
              onClick={fetchTasks}
              disabled={tasksLoading}
              title="Refresh"
              className="text-charcoal-600 hover:text-accent-400 transition-colors disabled:opacity-30"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${tasksLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 chat-scroll">
            {tasksLoading && tasks.length === 0 ? (
              /* Spinner also masks Render backend cold-start latency */
              <div className="flex flex-col items-center justify-center h-40 gap-2">
                <Spinner />
                <span className="text-xs text-charcoal-600 font-code">loading tasks…</span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-12">
                <Circle className="w-8 h-8 mx-auto mb-2 text-charcoal-700" />
                <p className="text-xs text-charcoal-600 font-code">// no tasks yet</p>
                <p className="text-xs text-charcoal-700 mt-1">Ask the AI to add one</p>
              </div>
            ) : (
              tasks.map((task) => {
                const s = STATUS[task.status] ?? STATUS.pending;
                const Icon = s.Icon;
                return (
                  <div
                    key={task.id}
                    className="bg-charcoal-800 border border-charcoal-700 hover:border-charcoal-600 rounded-xl p-3 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="w-3.5 h-3.5 mt-0.5 text-charcoal-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-charcoal-100 truncate">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-charcoal-500 mt-0.5 line-clamp-2">{task.description}</p>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <span className={s.cls}>{s.label}</span>
                          <span className="text-charcoal-700 text-xs font-code">#{task.id}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ════ RIGHT: Chat ════ */}
        <main className="flex-1 flex flex-col bg-charcoal-950">
          {/* Chat header */}
          <div className="px-4 py-3 bg-charcoal-900 border-b border-charcoal-700 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-accent-400" />
            <span className="text-sm font-semibold text-charcoal-100 font-code">agent</span>
            <span className="text-xs text-charcoal-600 font-code ml-1">groq · llama-3.3-70b-versatile</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto chat-scroll p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  {/* Bubble */}
                  <div
                    className={`px-4 py-2.5 rounded-xl text-sm whitespace-pre-wrap leading-relaxed ${
                      msg.role === "user"
                        ? "bg-accent-600 text-charcoal-950 font-medium rounded-br-sm"
                        : "bg-charcoal-800 border border-charcoal-700 text-charcoal-200 rounded-bl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Tool-call badges — monospace, cyan-tinted */}
                  {msg.tools_called && msg.tools_called.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.tools_called.map((tc, j) => (
                        <span key={j} title={JSON.stringify(tc.args, null, 2)} className="badge-tool">
                          <Wrench className="w-2.5 h-2.5" />
                          {tc.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Thinking indicator — also masks Render cold-start latency */}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-charcoal-800 border border-charcoal-700 rounded-xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                  <Spinner cls="text-accent-500" />
                  <span className="text-xs text-charcoal-500 font-code animate-pulse">thinking…</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input bar */}
          <div className="bg-charcoal-900 border-t border-charcoal-700 p-4">
            <div className="flex gap-3 items-end">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Tell the agent what to do…"
                className="input-dark flex-1 resize-none"
              />
              <button
                onClick={handleSend}
                disabled={chatLoading || !input.trim()}
                className="btn-primary flex-shrink-0 p-2.5"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-charcoal-700 font-code mt-2 text-center">
              Enter to send · Shift+Enter for newline
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
