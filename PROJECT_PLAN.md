# TaskPilot — Project Plan

## Project Choice
**Project B: TaskPilot** — An AI-powered task management agent where users manage to-do tasks by chatting with an AI that calls real tools to modify the database.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENT BROWSER                     │
│          React (Vite) + TailwindCSS Frontend            │
│   ┌───────────┐  ┌──────────────┐  ┌────────────────┐  │
│   │ Login /   │  │  Task List   │  │  AI Chat       │  │
│   │ Signup    │  │  Page        │  │  Interface     │  │
│   └───────────┘  └──────────────┘  └────────────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS (JWT Bearer token)
┌──────────────────────────▼──────────────────────────────┐
│               Python FastAPI Backend                    │
│                                                         │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  /auth   │  │  /tasks      │  │  /agent/chat     │  │
│  │  login   │  │  CRUD        │  │  Groq tool call  │  │
│  │  signup  │  │  (user-iso.) │  │  loop            │  │
│  └──────────┘  └──────────────┘  └──────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │            /admin/tasks  (require_admin)         │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────┘
            ┌──────────────┴──────────────┐
            │                             │
┌───────────▼──────────┐     ┌────────────▼──────────────┐
│  Neon PostgreSQL      │     │  Groq API                 │
│  (SQLAlchemy ORM)     │     │  llama-3.3-70b-versatile  │
│  Users + Tasks tables │     │  Native tool/fn calling   │
└──────────────────────┘     └───────────────────────────┘
```

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Backend | **Python + FastAPI** | Required; async, great DX, automatic /docs |
| Frontend | **React + Vite** | Fast dev server, easy deployment to Vercel |
| Database | **PostgreSQL on Neon** | Free, persistent (survives restarts), recommended |
| LLM | **Groq (llama-3.3-70b-versatile)** | Free tier, fastest inference, native tool calling |
| Auth | **JWT (python-jose) + bcrypt** | Standard, stateless, no third-party dependency |
| ORM | **SQLAlchemy** | Mature, easy migrations-free usage for this scope |
| Styling | **TailwindCSS** | Utility-first, fast to prototype |

---

## Roles & Permissions

| Capability | `user` | `admin` |
|------------|--------|---------|
| Login / Signup | ✅ | ✅ |
| View own tasks | ✅ | ✅ |
| Create / update / delete own tasks | ✅ | ✅ |
| Chat with AI agent (own tasks only) | ✅ | ✅ |
| View **all** tasks system-wide | ❌ | ✅ |
| View all users | ❌ | ✅ |

> Role enforcement is **always on the backend**. Even if a user crafts a raw HTTP request, `require_admin` will return HTTP 403.

---

## Backend File Structure

```
backend/
├── main.py          # FastAPI app, all routes, startup seed, agent endpoint
├── models.py        # SQLAlchemy ORM models (User, Task)
├── database.py      # Engine + SessionLocal + Base
├── auth.py          # JWT helpers, get_current_user, require_admin
├── agent.py         # Groq tool-calling agent loop
├── requirements.txt
└── .env             # (gitignored) DATABASE_URL, GROQ_API_KEY, SECRET_KEY
```

---

## Frontend File Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── TaskList.jsx
│   │   ├── ChatPanel.jsx
│   │   ├── AdminPanel.jsx
│   │   └── Navbar.jsx
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Signup.jsx
│   │   ├── Dashboard.jsx
│   │   └── Admin.jsx
│   ├── api.js       # Axios instance with JWT interceptor
│   └── App.jsx
├── index.html
└── vite.config.js
```

---

## AI Agent Design (Groq Tool Calling)

The agent endpoint receives a user's chat message and runs a **tool-calling loop**:

1. Send message + available tools to Groq.
2. Groq returns a `tool_calls` list.
3. Backend executes each tool call **using `current_user.id`** as a hard-coded filter — the LLM never controls which user's data is accessed.
4. Tool results are appended to the conversation and sent back to Groq.
5. Groq produces a final natural-language reply.

**Available tools the LLM can call:**
- `create_task(title, description)` — adds a task for current user
- `list_tasks(status?)` — lists current user's tasks (optional status filter)
- `update_task(task_id, status?, title?, description?)` — updates if task belongs to current user
- `delete_task(task_id)` — deletes if task belongs to current user

---

## Security Checklist

- [x] Passwords hashed with bcrypt (never stored plain)
- [x] JWTs signed with `SECRET_KEY` from env, 30-min expiry
- [x] `require_admin` dependency returns HTTP 403 if `role != 'admin'`
- [x] All task mutations verify `task.user_id == current_user.id`
- [x] No secrets in repo (`.env` in `.gitignore`, `.env.example` provided)
- [x] New signups always get role `'user'` — no self-promotion to admin

---

## Deployment Plan

| Part | Platform | Notes |
|------|----------|-------|
| Frontend | Vercel | Auto-deploy from GitHub, free |
| Backend | Render Free Web Service | Sleeps after 15 min idle; mention in README |
| Database | Neon PostgreSQL | Already configured via `.env` |

---

## Demo Credentials (seeded on startup)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@taskpilot.com | Admin@123 |
| User | user@taskpilot.com | User@123 |
