# TaskPilot ⚡ — AI-Powered Task Management Agent

> **QuantumApps AI · AI Engineer (Full Stack) Round 1 · Project B**

---

## Project Chosen

**Project B: TaskPilot** — an AI agent that lets users manage their to-do tasks through a natural language chat interface. Instead of clicking through forms, users type requests like *"Add a task to submit the monthly report"* or *"Mark my PR review as done"* and the agent calls the right database tools automatically. All changes are immediately reflected in the live task list beside the chat window.

---

## Live URLs & Demo Logins

| | URL |
|---|---|
| 🌐 **Frontend** | `https://task-pilot-ai-seven.vercel.app` |
| ⚙️ **Backend API** | `https://taskpilotai-16cd.onrender.com` |
| 📄 **API Docs** | `https://taskpilotai-16cd.onrender.com/docs` |

> [!NOTE]
> The backend runs on Render's free tier and **sleeps after 15 minutes of inactivity**. The first request after a sleep period may take up to ~50 seconds. The UI displays a branded loading spinner during this wait — no crash, no blank screen.

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| 👑 Admin | `admin@taskpilot.com` | `Admin@123` |
| 👤 User | `user@taskpilot.com` | `User@123` |

The login page includes **"Fill Demo Admin"** and **"Fill Demo User"** quick-fill buttons so you can test both roles without typing.

---

## Tech Stack & Choices

| Layer | Technology | Why |
|-------|-----------|-----|
| **Backend** | Python + FastAPI | Required by the assignment; async, fast, and ships with auto-generated `/docs` |
| **Frontend** | React 19 + Vite + TypeScript | Instant dev server, first-class TS support, deployed to Vercel in one command |
| **Database** | PostgreSQL on **Neon** | Free persistent serverless Postgres — survives Render restarts unlike SQLite; recommended in the spec |
| **LLM / Agent** | **Groq** (`openai/gpt-oss-120b`) | Groq's LPU hardware delivers inference at ~500 tok/s — the multi-step tool loop (list → find ID → update) completes in under 2 seconds, making the agent feel instant |
| **Auth** | JWT (`python-jose`) + `passlib[bcrypt]` | Stateless, no third-party dependency, standard in FastAPI; bcrypt's cost factor resists brute-force |
| **ORM** | SQLAlchemy | Mature, migration-free for this scope, integrates cleanly with FastAPI's `Depends()` |
| **Styling** | Tailwind CSS v3 | Utility-first — the entire UI was built without writing a custom CSS class |

---

## Local Setup

### Prerequisites

- Python ≥ 3.11
- Node.js ≥ 18
- A [Neon](https://neon.tech) Postgres database (free)
- A [Groq](https://console.groq.com) API key (free)

### 1 — Clone the repo

```bash
git clone https://github.com/kiruthicpranesh/TaskPilotAI.git
cd taskpilot
```

### 2 — Backend setup

```bash
cd backend
```

Create your `.env` file (copy from the example):

```bash
cp .env.example .env
```

Fill in the three values:

```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
GROQ_API_KEY=gsk_...
SECRET_KEY=any-random-32-char-string
```

> Generate a secret key with:
> ```bash
> python -c "import secrets; print(secrets.token_hex(32))"
> ```

Install dependencies and start the server:

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

The API will be live at `http://127.0.0.1:8000`.  
On first startup it **auto-creates tables** and **seeds both demo accounts** with sample tasks.

### 3 — Frontend setup

```bash
cd ../frontend
```

The frontend ships with a default `.env` pointing to localhost:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, click **"Fill Demo User"**, and start chatting.

---

## How the AI Works

### Architecture

```
User types message
      │
      ▼
POST /chat  (JWT validated → current_user.id extracted)
      │
      ▼
run_agent(message, current_user_id, db)   ← agent.py
      │
      ├─► Build conversation: [system_prompt, {role: user, content: ...}]
      │
      ├─► LOOP ──────────────────────────────────────────────────────────┐
      │       │                                                          │
      │       ├─► Call Groq API with message + TOOL_SCHEMAS             │
      │       │                                                          │
      │       │   finish_reason == "tool_calls"?                        │
      │       │       ├─► Parse tool name + args from LLM               │
      │       │       ├─► Inject current_user_id (server-side)          │
      │       │       ├─► Execute Python function → DB query            │
      │       │       ├─► Append tool result to conversation            │
      │       │       └─► Loop again ──────────────────────────────────► │
      │       │                                                          │
      │       └─► finish_reason == "stop"?                              │
      │               Return final text reply ◄────────────────────────── ┘
      │
      ▼
{ "reply": "...", "tools_called": [{name, args}, ...] }
```

### Native Tool Calling

The agent uses **Groq's native function-calling API** — no LangChain or framework in the middle. Four tools are defined as JSON schemas and passed to the Groq API:

| Tool | What it does |
|------|-------------|
| `add_task` | Creates a new task in the database |
| `list_tasks` | Retrieves the user's tasks (optional status filter) |
| `update_task` | Changes a task's title, description, or status |
| `delete_task` | Permanently removes a task |

### Multi-Step Requests

A single message like *"Add a report task and mark my PR task as done"* triggers the full loop:

1. Groq returns `tool_calls: [add_task, list_tasks]`
2. `add_task` runs → new row inserted
3. `list_tasks` runs → returns IDs so the agent knows which task to update
4. Groq returns `tool_calls: [update_task]`
5. `update_task` runs → status set to `done`
6. Groq returns a natural-language confirmation → loop exits

### 🔒 Security: `user_id` Is Never Exposed to the LLM

This is the most important security property of the agent:

```python
# TOOL_SCHEMAS sent to Groq — notice: no user_id parameter
{
  "name": "add_task",
  "parameters": {
    "properties": {
      "title":       {"type": "string"},
      "description": {"type": "string"}
      # ← user_id is intentionally absent here
    }
  }
}
```

When the backend dispatches a tool call, `current_user.id` is injected directly from the validated JWT — the LLM's arguments are treated as untrusted input. The dispatcher also defensively strips any `user_id` the model might hallucinate:

```python
def _dispatch(tool_name, llm_args, current_user_id, db):
    llm_args.pop("user_id", None)          # strip any hallucinated user_id
    fn(**llm_args, current_user_id=current_user_id, db=db)  # inject trusted value
```

Every database query then filters on `Task.user_id == current_user_id`. The agent is **structurally incapable** of reading or modifying another user's tasks, regardless of what the LLM outputs.

---

## Login & Roles

### How JWT Auth Works

1. **Login** — user POSTs credentials to `/auth/login`. Backend verifies the bcrypt hash, creates a signed JWT containing `{sub: email, role: role}`, and returns it.
2. **Subsequent requests** — the frontend attaches the token as `Authorization: Bearer <token>`. The backend's `get_current_user` dependency decodes and verifies the JWT on every request.
3. **Role enforcement** — the `require_admin` dependency calls `get_current_user`, then checks `role == "admin"`. If not, it raises **HTTP 403** before the route handler body executes.

### Preventing API Abuse

Role enforcement lives **entirely on the backend** — the frontend only hides buttons for convenience. A regular user who discovers the admin URL and calls it directly with a valid JWT gets:

```
403 Forbidden — "Admin access required."
```

The route handler never runs. This satisfies the assignment requirement: *"If a normal user calls an admin API directly, it must be refused."*

New signups always receive `role = "user"` — this is hardcoded in the `/auth/signup` handler and cannot be overridden by the caller:

```python
user = User(
    email=payload.email,
    hashed_password=hash_password(payload.password),
    role="user",   # hardcoded — no path exists for a user to self-promote to admin
)
```

---

## What's Not Finished / Could Be Improved

### Known Limitation — Render Cold Start

The backend is hosted on Render's **free tier**, which suspends the service after 15 minutes of inactivity. The first request after a sleep takes **~50 seconds** to respond. This is handled gracefully:

- The login page shows a spinner with the label *"Signing in…"* during the wait
- The chat panel shows *"Thinking…"* with a spinner
- The task list shows a skeleton loader

A production fix would use **Render's paid tier** (no sleep) or ping the backend on a cron schedule to keep it warm.

### Other Improvements

| Area | Suggestion |
|------|-----------|
| **Task reminders** | Add a `due_date` column and a cron job (e.g. GitHub Actions or Render cron) that emails users about tasks due today |
| **Confirmation before delete** | The agent could ask *"Are you sure you want to delete 'X'?"* before calling `delete_task` for safety |
| **Tool call transparency** | The frontend already shows tool badges; a collapsible "Agent log" panel could show the full tool arguments and results |
| **Priorities & categories** | Add `priority` and `category` columns; expose them as agent tool parameters |
| **Admin: assign tasks** | An `assign_task(task_id, target_user_id)` tool restricted to admins so managers can delegate |
| **Streaming replies** | Use Groq's streaming API to show the AI's response word-by-word instead of waiting for the full reply |
| **Tests** | Add `pytest` unit tests for `auth.py` and `agent.py`, and Playwright end-to-end tests for the login flow |
| **Token refresh** | Current JWTs expire after 30 minutes; add a `/auth/refresh` endpoint to extend sessions silently |

---

## Project Structure

```
taskpilot/
├── backend/
│   ├── main.py          # FastAPI app, all routes, startup seed
│   ├── agent.py         # Groq tool-calling agent loop
│   ├── auth.py          # JWT helpers, get_current_user, require_admin
│   ├── models.py        # SQLAlchemy ORM: User, Task
│   ├── database.py      # Engine + SessionLocal + Base
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api.ts           # Axios instance + all API calls
│   │   ├── AuthContext.tsx  # Global auth state + useAuth() hook
│   │   ├── App.tsx          # Router + ProtectedRoute
│   │   └── pages/
│   │       ├── Auth.tsx      # Login / Signup with quick-fill buttons
│   │       ├── Dashboard.tsx # Split-screen: task list + AI chat
│   │       └── Admin.tsx     # Admin: all users + all tasks
│   └── .env
├── PROJECT_PLAN.md
└── README.md
```

---

*Built for QuantumApps AI — AI Engineer (Full Stack) Take-Home Assignment, Round 1.*
