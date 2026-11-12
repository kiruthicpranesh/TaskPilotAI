"""
agent.py — Groq tool-calling agent for TaskPilot.

ARCHITECTURE (for your interview):
────────────────────────────────────────────────────────────────────────────
  User message
      │
      ▼
  run_agent(user_message, current_user_id, db)
      │
      ├─► Build conversation: [system_prompt, {role:user, content:...}]
      │
      ├─► Loop ──────────────────────────────────────────────────────────┐
      │       │                                                          │
      │       ├─► Call Groq API with messages + TOOL_SCHEMAS            │
      │       │                                                          │
      │       │   If response.choices[0].finish_reason == "tool_calls": │
      │       │       ├─► Parse each tool_call from the LLM             │
      │       │       ├─► Dispatch to local Python function             │
      │       │       │   (current_user_id injected here — LLM never    │
      │       │       │    controls who owns the task)                   │
      │       │       ├─► Append tool results to conversation           │
      │       │       └─► Continue loop ──────────────────────────────► │
      │       │                                                          │
      │       └─► If finish_reason == "stop":                           │
      │               Return final text reply  ◄──────────────────────── ┘
      │
      └─► Return {reply, tools_called}

SECURITY MODEL:
  The TOOL_SCHEMAS sent to Groq define the function signatures. Notice that
  user_id is NOT in any schema — the LLM cannot specify or spoof a user.
  When the backend dispatches a tool call, it passes current_user_id from the
  verified JWT as a hardcoded argument. The DB query then filters on that id.
  Result: the agent is structurally incapable of touching another user's data.
────────────────────────────────────────────────────────────────────────────
"""

import json
import os
from typing import Any

from dotenv import load_dotenv
from groq import Groq
from sqlalchemy.orm import Session

from models import Task

load_dotenv()

# ---------------------------------------------------------------------------
# Groq client (singleton — reused across requests)
# ---------------------------------------------------------------------------

_groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = "openai/gpt-oss-120b"

# ---------------------------------------------------------------------------
# Tool schemas — what we expose to the LLM
#
# INTERVIEW POINT: user_id is deliberately absent from every schema.
# The LLM only knows about task content (title, description, status, task_id).
# The backend injects the real user_id when it executes the function.
# ---------------------------------------------------------------------------

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "add_task",
            "description": (
                "Create a new task for the current user. "
                "Use when the user wants to add, create, or schedule a new to-do."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Short title for the task.",
                    },
                    "description": {
                        "type": "string",
                        "description": "Optional longer description or notes.",
                    },
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_tasks",
            "description": (
                "List the current user's tasks. "
                "Optionally filter by status: 'pending', 'in_progress', or 'done'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "enum": ["pending", "in_progress", "done"],
                        "description": "Filter tasks by this status. Omit to list all.",
                    },
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_task",
            "description": (
                "Update an existing task's title, description, or status. "
                "Use when the user wants to mark a task done, rename it, or change its state."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {
                        "type": "integer",
                        "description": "The numeric ID of the task to update.",
                    },
                    "title": {
                        "type": "string",
                        "description": "New title (optional).",
                    },
                    "description": {
                        "type": "string",
                        "description": "New description (optional).",
                    },
                    "status": {
                        "type": "string",
                        "enum": ["pending", "in_progress", "done"],
                        "description": "New status (optional).",
                    },
                },
                "required": ["task_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_task",
            "description": (
                "Permanently delete a task. "
                "Use only when the user explicitly asks to remove or delete a task."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "task_id": {
                        "type": "integer",
                        "description": "The numeric ID of the task to delete.",
                    },
                },
                "required": ["task_id"],
            },
        },
    },
]

# ---------------------------------------------------------------------------
# Tool implementation functions
#
# SECURITY: Every function receives current_user_id as a parameter that is
# injected by the backend dispatcher below — never from the LLM's arguments.
# All DB queries filter on Task.user_id == current_user_id so the agent
# literally cannot read or write another user's rows.
# ---------------------------------------------------------------------------

def add_task(
    title: str,
    current_user_id: int,
    db: Session,
    description: str = "",
) -> dict:
    """Insert a new Task row owned by current_user_id."""
    task = Task(
        title=title,
        description=description,
        status="pending",
        user_id=current_user_id,    # ← injected by backend, not from LLM
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {
        "success": True,
        "task": {"id": task.id, "title": task.title, "status": task.status},
    }


def list_tasks(
    current_user_id: int,
    db: Session,
    status: str | None = None,
) -> dict:
    """Return tasks belonging to current_user_id, optionally filtered by status."""
    query = db.query(Task).filter(Task.user_id == current_user_id)  # isolation
    if status:
        query = query.filter(Task.status == status)
    tasks = query.all()
    return {
        "tasks": [
            {"id": t.id, "title": t.title, "description": t.description, "status": t.status}
            for t in tasks
        ]
    }


def update_task(
    task_id: int,
    current_user_id: int,
    db: Session,
    title: str | None = None,
    description: str | None = None,
    status: str | None = None,
) -> dict:
    """Update a task — only if it belongs to current_user_id."""
    task = (
        db.query(Task)
        .filter(Task.id == task_id, Task.user_id == current_user_id)  # isolation
        .first()
    )
    if not task:
        # Return a message instead of raising — the LLM can communicate this naturally.
        return {"success": False, "error": f"Task {task_id} not found or not yours."}

    if title is not None:
        task.title = title
    if description is not None:
        task.description = description
    if status is not None:
        task.status = status

    db.commit()
    db.refresh(task)
    return {
        "success": True,
        "task": {"id": task.id, "title": task.title, "status": task.status},
    }


def delete_task(
    task_id: int,
    current_user_id: int,
    db: Session,
) -> dict:
    """Delete a task — only if it belongs to current_user_id."""
    task = (
        db.query(Task)
        .filter(Task.id == task_id, Task.user_id == current_user_id)  # isolation
        .first()
    )
    if not task:
        return {"success": False, "error": f"Task {task_id} not found or not yours."}

    db.delete(task)
    db.commit()
    return {"success": True, "deleted_task_id": task_id}


# ---------------------------------------------------------------------------
# Tool dispatcher
#
# Maps the LLM's tool name string to the corresponding Python function.
# current_user_id and db are always injected here — the LLM args dict is
# never allowed to override them.
# ---------------------------------------------------------------------------

_TOOL_REGISTRY: dict[str, Any] = {
    "add_task":    add_task,
    "list_tasks":  list_tasks,
    "update_task": update_task,
    "delete_task": delete_task,
}


def _dispatch(tool_name: str, llm_args: dict, current_user_id: int, db: Session) -> str:
    """
    Call the Python tool function that matches tool_name.

    INTERVIEW POINT:
    llm_args comes directly from the LLM — we treat it as untrusted input.
    We pop any 'user_id' the LLM might try to inject (defensive), then merge
    our trusted current_user_id before calling the function.
    The result is JSON-serialised and returned as a string, which is the format
    Groq expects for a tool result message.
    """
    fn = _TOOL_REGISTRY.get(tool_name)
    if fn is None:
        return json.dumps({"error": f"Unknown tool: {tool_name}"})

    # Defensive: strip any user_id the LLM might hallucinate into the args.
    llm_args.pop("user_id", None)

    # Inject trusted server-side values — these override anything from the LLM.
    result = fn(**llm_args, current_user_id=current_user_id, db=db)
    return json.dumps(result)


# ---------------------------------------------------------------------------
# Main agent loop
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are TaskPilot, a friendly AI assistant that helps users manage their tasks.
You have tools to add, list, update, and delete tasks.

Rules:
- Always use a tool when the user wants to perform a task action.
- For multi-step requests (e.g. "add X and mark Y done"), call all necessary tools.
- After all tools complete, give a brief, friendly confirmation in plain English.
- If you need to update or delete a specific task but don't know its ID, call list_tasks first.
- Never make up task IDs; always retrieve them from list_tasks.
- Keep replies concise — one or two sentences after the action."""


def run_agent(
    user_message: str,
    current_user_id: int,
    db: Session,
) -> dict:
    """
    Run the Groq tool-calling agent loop.

    Returns:
        {
            "reply":        str,              # Final natural-language response
            "tools_called": list[dict],       # [{name, args}, ...] for the frontend
        }

    LOOP EXPLANATION (for interview):
    ──────────────────────────────────
    1. We build a conversation starting with the system prompt + user message.
    2. We call Groq with TOOL_SCHEMAS so the LLM knows what tools are available.
    3. If the LLM decides to call tools, it returns finish_reason="tool_calls"
       and a list of tool_calls (name + JSON args).
    4. We execute each tool locally, append the results as "tool" role messages,
       and call Groq AGAIN with the updated conversation.
    5. We repeat until finish_reason="stop", which means the LLM is done calling
       tools and is giving us a final text answer.
    6. We return that answer plus a log of every tool that ran.

    This loop is what makes the agent "multi-step": a single user message can
    trigger add_task, then list_tasks, then update_task — all in one /chat call.
    """
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": user_message},
    ]
    tools_called: list[dict] = []   # accumulates every tool execution for the response

    # Safety cap: at most 10 Groq round-trips to prevent infinite loops.
    MAX_ITERATIONS = 10

    for iteration in range(MAX_ITERATIONS):
        response = _groq_client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOL_SCHEMAS,
            tool_choice="auto",     # let the LLM decide whether to call a tool
        )

        choice = response.choices[0]

        # ── Case 1: LLM wants to call one or more tools ─────────────────────
        if choice.finish_reason == "tool_calls":
            assistant_message = choice.message

            # Append the assistant's tool-call request to the conversation so
            # Groq can match our tool results to the right call_id.
            messages.append(assistant_message)

            # Execute every tool the LLM requested in this round.
            for tool_call in assistant_message.tool_calls:
                name = tool_call.function.name
                args = json.loads(tool_call.function.arguments)

                # Record for the API response (shown as badges in the frontend).
                tools_called.append({"name": name, "args": args})

                # Dispatch: inject current_user_id from the JWT — never from args.
                result_str = _dispatch(name, args, current_user_id, db)

                # Append the tool result so the LLM can read what happened.
                messages.append({
                    "role":         "tool",
                    "tool_call_id": tool_call.id,   # must match the LLM's call_id
                    "name":         name,
                    "content":      result_str,
                })

            # Loop again — the LLM will now produce either more tool calls or a reply.
            continue

        # ── Case 2: LLM is done — return its final text response ─────────────
        final_reply = choice.message.content or "Done! Let me know if you need anything else."
        return {"reply": final_reply, "tools_called": tools_called}

    # Fallback if we somehow hit the iteration cap.
    return {
        "reply": "I completed the requested actions. Let me know if you need anything else.",
        "tools_called": tools_called,
    }
