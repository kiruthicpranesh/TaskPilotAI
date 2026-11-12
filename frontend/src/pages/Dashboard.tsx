/**
 * Dashboard.tsx — Split-screen user workspace.
 *
 * Layout:
 *   ┌─────────────────────┬──────────────────────┐
 *   │   Task List (left)  │   AI Chat (right)    │
 *   │   GET /tasks        │   POST /chat         │
 *   └─────────────────────┴──────────────────────┘
 *
 * Auto-refresh: after every successful chat response, fetchTasks() is called
 * so the task list immediately reflects changes the agent made (e.g. a new
 * task added, a status changed to 'done').
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2, Circle, Clock, LogOut, MessageSquare,
  RefreshCw, Send, Settings, Wrench, Zap,
} from "lucide-react";
import { getTasks, sendChat, type Task, type ToolCall } from "../api";
import { useAuth } from "../AuthContext";

// ── Status badge config ──────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:     { label: "Pending",     icon: Circle,       color: "bg-yellow-100 text-yellow-700" },
  in_progress: { label: "In Progress", icon: Clock,        color: "bg-blue-100 text-blue-700"   },
  done:        { label: "Done",        icon: CheckCircle2, color: "bg-green-100 text-green-700" },
} as const;

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

  // Task list state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Hi ${user?.email?.split("@")[0] ?? "there"}! 👋 I'm TaskPilot. Try saying:\n• "Add a task to review the PR"\n• "What tasks are pending?"\n• "Mark my first task as done"`,
    },
  ]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // ── Fetch tasks ────────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const data = await getTasks();
      setTasks(data);
    } catch {
      // Silently fail — user will see the stale list
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Auto-scroll chat to bottom whenever a new message arrives
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send chat message ──────────────────────────────────────────────────────

  async function handleSend() {
    const text = input.trim();
    if (!text || chatLoading) return;

    // Append user bubble immediately for snappy UX
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setChatLoading(true);

    try {
      const res = await sendChat(text);

      // Append the AI's reply + tool badges
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply, tools_called: res.tools_called },
      ]);

      // Auto-refresh task list so changes made by the agent are visible immediately.
      // This is the key UX loop: chat action → DB change → task list reflects it.
      await fetchTasks();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "The AI is unavailable. Please try again.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${detail}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/");
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-purple-600 rounded-lg p-1.5">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg">TaskPilot</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 hidden sm:block">{user?.email}</span>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium capitalize">
            {user?.role}
          </span>
          {user?.role === "admin" && (
            <button
              onClick={() => navigate("/admin")}
              className="text-sm flex items-center gap-1 text-gray-600 hover:text-purple-600 transition-colors"
            >
              <Settings className="w-4 h-4" /> Admin
            </button>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      {/* ── Split layout ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 57px)" }}>

        {/* ════════ LEFT: Task List ════════ */}
        <aside className="w-80 xl:w-96 bg-white border-r border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-500" />
              My Tasks
              <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
                {tasks.length}
              </span>
            </h2>
            <button
              onClick={fetchTasks}
              disabled={tasksLoading}
              title="Refresh tasks"
              className="text-gray-400 hover:text-purple-600 transition-colors disabled:opacity-40"
            >
              {/* Spinner also masks the Render free-tier cold-start wake-up time */}
              <RefreshCw className={`w-4 h-4 ${tasksLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {tasksLoading && tasks.length === 0 ? (
              /* Loading state — shown on first load & after Render cold-start */
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <svg className="animate-spin h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <span className="text-sm text-gray-400">Loading tasks…</span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Circle className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No tasks yet.</p>
                <p className="text-xs mt-1">Ask the AI to add one!</p>
              </div>
            ) : (
              tasks.map((task) => {
                const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;
                const Icon = cfg.icon;
                return (
                  <div
                    key={task.id}
                    className="bg-gray-50 rounded-xl p-3 border border-gray-100 hover:border-purple-200 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <span className="text-xs text-gray-300">#{task.id}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ════════ RIGHT: AI Chat ════════ */}
        <main className="flex-1 flex flex-col bg-gray-50">
          <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-purple-500" />
            <span className="font-semibold text-gray-800">AI Agent</span>
            <span className="text-xs text-gray-400 ml-1">Powered by Groq · llama-3.3-70b</span>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto chat-scroll p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  {/* Bubble */}
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-purple-600 text-white rounded-br-sm"
                        : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Tool call badges — show which tools the agent invoked */}
                  {msg.tools_called && msg.tools_called.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {msg.tools_called.map((tc, j) => (
                        <span
                          key={j}
                          title={JSON.stringify(tc.args, null, 2)}
                          className="inline-flex items-center gap-1 text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-medium"
                        >
                          <Wrench className="w-3 h-3" />
                          {tc.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* AI thinking indicator */}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-2">
                  {/* Spinner — also masks Render backend cold-start latency gracefully */}
                  <svg className="animate-spin h-3.5 w-3.5 text-purple-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span className="text-sm text-gray-400">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input bar */}
          <div className="bg-white border-t border-gray-200 p-4">
            <div className="flex gap-3 items-end">
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask the AI to manage your tasks…"
                className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
              />
              <button
                onClick={handleSend}
                disabled={chatLoading || !input.trim()}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
