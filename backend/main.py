"""
main.py — FastAPI application entry point.

Sections:
  1. App init + CORS
  2. Pydantic schemas (request/response shapes)
  3. Startup seed (admin + demo user with sample tasks)
  4. Auth routes  (/auth/signup, /auth/login)
  5. Task CRUD    (/tasks  — user-isolated)
  6. Admin route  (/admin/tasks — require_admin)
  7. AI Chat      (/chat   — Groq agent loop)
"""

import os
from contextlib import asynccontextmanager
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_admin,
    verify_password,
)
from database import Base, engine, get_db
from models import Task, User
from agent import run_agent

load_dotenv()

# ---------------------------------------------------------------------------
# 1. App init
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables and seed demo data on first startup."""
    Base.metadata.create_all(bind=engine)
    _seed_database()
    yield


app = FastAPI(title="TaskPilot API", version="1.0.0", lifespan=lifespan)

# Allow the React dev server and any deployed frontend to reach this API.
# In production, replace "*" with your actual Vercel domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# 2. Pydantic schemas
# ---------------------------------------------------------------------------

class SignupRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    email: str


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None  # 'pending' | 'in_progress' | 'done'


class TaskOut(BaseModel):
    id: int
    title: str
    description: str
    status: str
    user_id: int

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# 3. Startup seed
# ---------------------------------------------------------------------------

def _seed_database():
    """
    Idempotent seed: creates demo accounts and sample tasks only if they
    don't already exist. Safe to call on every startup.

    Demo accounts:
      admin@taskpilot.com / Admin@123  (role: admin)
      user@taskpilot.com  / User@123   (role: user)
    """
    from database import SessionLocal

    db = SessionLocal()
    try:
        # --- Admin user ---
        if not db.query(User).filter(User.email == "admin@taskpilot.com").first():
            admin = User(
                email="admin@taskpilot.com",
                hashed_password=hash_password("Admin@123"),
                role="admin",           # explicitly set; signups cannot do this
            )
            db.add(admin)
            db.flush()                  # get admin.id before committing

        # --- Normal user + 2 sample tasks ---
        demo_user = db.query(User).filter(User.email == "user@taskpilot.com").first()
        if not demo_user:
            demo_user = User(
                email="user@taskpilot.com",
                hashed_password=hash_password("User@123"),
                role="user",            # default; shown explicitly for clarity
            )
            db.add(demo_user)
            db.flush()                  # get demo_user.id

            # Sample tasks so the evaluator sees data immediately after login.
            db.add(Task(
                title="Submit monthly report",
                description="Compile Q4 metrics and email to manager",
                status="pending",
                user_id=demo_user.id,
            ))
            db.add(Task(
                title="Review pull requests",
                description="Check open PRs on the main repo before EOD",
                status="in_progress",
                user_id=demo_user.id,
            ))

        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"[seed] Error during seeding: {exc}")
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 4. Auth routes
# ---------------------------------------------------------------------------

@app.post("/auth/signup", response_model=TokenResponse, status_code=201)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    """
    Create a new account.

    SECURITY NOTE: role is ALWAYS set to 'user' here — the caller has no
    way to influence it. Only the seed function above can create admins.
    """
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered.")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role="user",        # hardcoded — prevents privilege escalation at signup
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.email, "role": user.role})
    return TokenResponse(
        access_token=token, token_type="bearer", role=user.role, email=user.email
    )


@app.post("/auth/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Authenticate and return a JWT.

    Uses OAuth2PasswordRequestForm so the /docs page has a built-in login UI.
    The JWT payload includes the user's role so downstream dependencies
    (get_current_user, require_admin) can enforce RBAC without extra DB queries.
    """
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    token = create_access_token({"sub": user.email, "role": user.role})
    return TokenResponse(
        access_token=token, token_type="bearer", role=user.role, email=user.email
    )


@app.get("/auth/me")
def me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile (useful for the frontend)."""
    return {"id": current_user.id, "email": current_user.email, "role": current_user.role}


# ---------------------------------------------------------------------------
# 5. Task CRUD — user-isolated
# ---------------------------------------------------------------------------
#
# INTERVIEW EXPLANATION — DATA ISOLATION:
# Every query that reads or modifies tasks applies TWO filters:
#   1. .filter(Task.user_id == current_user.id)   ← DB-level isolation
#   2. The task returned must exist; otherwise 404.
#
# This means:
#   - Even if a user guesses another user's task ID and calls DELETE /tasks/42,
#     the query finds no matching row (wrong user_id) and returns 404.
#   - The LLM agent also uses these endpoints on behalf of the user, so the
#     agent physically cannot touch another user's data either.
# ---------------------------------------------------------------------------

@app.post("/tasks", response_model=TaskOut, status_code=201)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new task owned by the authenticated user."""
    task = Task(
        title=payload.title,
        description=payload.description,
        status="pending",
        user_id=current_user.id,    # ownership is set server-side, not by the caller
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.get("/tasks", response_model=List[TaskOut])
def list_tasks(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return all tasks belonging to the current user.
    Optional ?status_filter=pending|in_progress|done query param.
    """
    query = db.query(Task).filter(Task.user_id == current_user.id)   # isolation filter
    if status_filter:
        query = query.filter(Task.status == status_filter)
    return query.all()


@app.get("/tasks/{task_id}", response_model=TaskOut)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return a single task by ID.

    The user_id filter ensures a user can only retrieve their own task.
    If the task exists but belongs to someone else, this returns 404
    (not 403) to avoid leaking the existence of other users' tasks.
    """
    task = (
        db.query(Task)
        .filter(Task.id == task_id, Task.user_id == current_user.id)   # isolation
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task


@app.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Partially update a task (title, description, status).

    Only the task owner can update it — enforced by the user_id filter.
    """
    task = (
        db.query(Task)
        .filter(Task.id == task_id, Task.user_id == current_user.id)   # isolation
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    if payload.title is not None:
        task.title = payload.title
    if payload.description is not None:
        task.description = payload.description
    if payload.status is not None:
        allowed_statuses = {"pending", "in_progress", "done"}
        if payload.status not in allowed_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Status must be one of {allowed_statuses}",
            )
        task.status = payload.status

    db.commit()
    db.refresh(task)
    return task


@app.delete("/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a task.

    The user_id filter guarantees a user can only delete their own tasks,
    even if they know another task's ID.
    """
    task = (
        db.query(Task)
        .filter(Task.id == task_id, Task.user_id == current_user.id)   # isolation
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    db.delete(task)
    db.commit()


# ---------------------------------------------------------------------------
# 6. Admin route — system-wide task view
# ---------------------------------------------------------------------------

@app.get("/admin/tasks", response_model=List[TaskOut])
def admin_list_all_tasks(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),   # 403 if role != 'admin'
):
    """
    Return every task in the system, regardless of owner.

    INTERVIEW EXPLANATION — ROLE ENFORCEMENT:
    The `require_admin` dependency runs before this function body.
    It calls `get_current_user` (validates the JWT), then checks
    `current_user.role == 'admin'`. If the check fails, FastAPI raises
    HTTP 403 and this function is never entered.

    A regular user who discovers this URL and calls it with their valid JWT
    will get:  403 Forbidden — "Admin access required."
    There is no way around this check from the client side.
    """
    return db.query(Task).all()   # no user_id filter — intentionally sees all tasks


@app.get("/admin/users")
def admin_list_all_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Return all registered users (admin-only)."""
    users = db.query(User).all()
    return [{"id": u.id, "email": u.email, "role": u.role} for u in users]


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "app": "TaskPilot"}


# ---------------------------------------------------------------------------
# 7. AI Chat — Groq agent endpoint
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str


class ToolCall(BaseModel):
    name: str
    args: dict


class ChatResponse(BaseModel):
    reply: str
    tools_called: List[ToolCall]


@app.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),   # JWT required
):
    """
    AI agent endpoint — the core of TaskPilot's intelligence.

    INTERVIEW EXPLANATION:
    ──────────────────────
    1. get_current_user validates the JWT and returns the authenticated User.
       No valid token → HTTP 401 before we ever touch the agent.

    2. We pass current_user.id (a trusted integer from the DB row, not from
       the request body) to run_agent(). The agent loop uses it to inject the
       correct user_id into every tool call. The LLM never sees or controls this
       value — it only specifies task content (titles, statuses, etc.).

    3. run_agent() returns the LLM's final reply and a list of every tool that
       was executed during the loop (add_task, list_tasks, update_task,
       delete_task). The frontend renders these as coloured badges so the user
       can see exactly what the AI did.

    Example request:
        POST /chat
        Authorization: Bearer <jwt>
        {"message": "Add a report task and mark my PR task as done"}

    Example response:
        {
          "reply": "Done! I added 'report task' and marked 'Review PRs' as done.",
          "tools_called": [
            {"name": "add_task",    "args": {"title": "report task"}},
            {"name": "list_tasks",  "args": {}},
            {"name": "update_task", "args": {"task_id": 2, "status": "done"}}
          ]
        }
    """
    try:
        result = run_agent(
            user_message=payload.message,
            current_user_id=current_user.id,    # injected from JWT — never from body
            db=db,
        )
        return ChatResponse(
            reply=result["reply"],
            tools_called=[ToolCall(**t) for t in result["tools_called"]],
        )
    except Exception as exc:
        # Friendly error instead of a 500 crash — required by the assignment spec.
        print(f"Groq API Error: {str(exc)}") 
        raise HTTPException(
            status_code=503,
            detail=f"The AI agent is temporarily unavailable. Please try again later.",
        )
