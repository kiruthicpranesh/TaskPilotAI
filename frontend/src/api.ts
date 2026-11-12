/**
 * api.ts — Axios instance + typed API helpers.
 *
 * The request interceptor reads the JWT from localStorage and attaches it
 * as "Authorization: Bearer <token>" on every outgoing request automatically.
 * This means no route or component ever has to manually set auth headers.
 *
 * Base URL is read from the Vite env variable VITE_API_URL so we can point
 * to localhost in dev and the Render URL in production without code changes.
 */

import axios from "axios";

// ── Axios instance ──────────────────────────────────────────────────────────

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT from localStorage before every request.
// If the user is not logged in, the header is simply omitted.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  email: string;
  role: "admin" | "user";
}

export interface Task {
  id: number;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "done";
  user_id: number;
}

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ChatResponse {
  reply: string;
  tools_called: ToolCall[];
}

// ── Auth API calls ───────────────────────────────────────────────────────────

export async function loginApi(email: string, password: string) {
  // FastAPI OAuth2 form expects x-www-form-urlencoded, not JSON.
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);
  const { data } = await api.post("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data as { access_token: string; role: string; email: string };
}

export async function signupApi(email: string, password: string) {
  const { data } = await api.post("/auth/signup", { email, password });
  return data as { access_token: string; role: string; email: string };
}

export async function getMeApi() {
  const { data } = await api.get("/auth/me");
  return data as AuthUser;
}

// ── Task API calls ───────────────────────────────────────────────────────────

export const getTasks = () =>
  api.get<Task[]>("/tasks").then((r) => r.data);

// ── Chat API call ────────────────────────────────────────────────────────────

export const sendChat = (message: string) =>
  api.post<ChatResponse>("/chat", { message }).then((r) => r.data);

// ── Admin API calls ──────────────────────────────────────────────────────────

export const getAdminTasks = () =>
  api.get<Task[]>("/admin/tasks").then((r) => r.data);

export const getAdminUsers = () =>
  api.get<AuthUser[]>("/admin/users").then((r) => r.data);
