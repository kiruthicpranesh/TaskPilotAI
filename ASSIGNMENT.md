QuantumApps AI — AI Engineer (Full Stack) Take-Home Assignment, Round 1
Oct 31, 2026 · @Mukesh
1. Overview
Pick one of the two projects below, build it end to end, deploy it on free hosting, and send us your GitHub repo and live URL within 48 hours of receiving this document.
This is the first technical round for the AI Engineer (Full Stack) – Fresher role at QuantumApps AI. We build AI-powered software for public-sector agencies and enterprises. This assignment is a small, beginner-friendly version of that work: an LLM-powered feature, a backend, a frontend, login, and role-based access.
Item
Detail
Choose
Project A (RAG Document Assistant) or Project B (Task Agent)
Time allowed
48 hours from receipt. We expect roughly 6–10 hours of focused work.
Fixed choices
Backend in FastAPI (Python); frontend in React or Next.js
Your choice
Everything else: LLM provider, database, libraries, UI design, folder structure, hosting
Cost to you
Zero. Use free tiers only; no credit card should be needed.
Team
Individual work only
The projects are deliberately simple to medium in size. What matters is that the end product works as described in your chosen project. We value a small app that works over a big one that doesn't.
2. Final deliverables (what you must send back)
Send us these five things. A missing live URL or a repo we cannot open means the submission will not be evaluated.
#
Deliverable
Requirement
1
Public GitHub repository
Frontend and backend code (one repo or two, your choice), with a real commit history
2
Live frontend URL
The deployed web app, usable without any setup on our side
3
Live backend URL
The deployed FastAPI service; its /docs page should load
4
Demo logins
One account per role (e.g. an admin and a normal user), with passwords
5
README.md
Short and clear, covering the points below
Your README should cover:
	•	Which project you chose and a 2–3 line summary
	•	Live URLs and demo logins
	•	Tech stack you chose (LLM, database, libraries) and why
	•	How to run it locally
	•	How the AI part works in a few sentences
	•	How login and roles work
	•	What is not finished or could be improved
Keep the app live for at least 14 days after you submit. Free backends often sleep when idle and take a minute to wake; that is fine, just mention it in the README.
3. Tech stack and common requirements
Only the backend and frontend frameworks are fixed. Choose everything else yourself and explain your choices in the README.
3.1 Stack
Layer
Rule
Suggestions
Backend
Required: Python + FastAPI
Any libraries you like
Frontend
Required: React or Next.js
JavaScript or TypeScript, any UI library
LLM
Your choice, must be free
Groq (fast, generous free tier), Google Gemini API free tier, OpenRouter free models, Hugging Face Inference, Mistral free tier, or any other free LLM API
Database
Your choice
PostgreSQL (Neon, Supabase) is recommended. MongoDB Atlas or any other free hosted database is fine. Avoid a local file database such as SQLite on free hosting, because the disk is usually wiped on restart.
Frameworks
Your choice
Plain code, LangChain, LangGraph, LlamaIndex: all fine, as long as you can explain what it does
3.2 Login and roles (Required)
Both projects need login and role-based access. How you build it is up to you (your own JWT auth in FastAPI, Supabase Auth, Clerk, etc.), but the result must meet these points:
	•	Users can sign up and log in. Passwords are never stored in plain text.
	•	Each user has a role. Each project lists its roles.
	•	Roles are enforced on the backend, not just by hiding buttons. If a normal user calls an admin API directly, it must be refused.
	•	New sign-ups get the normal user role; nobody can make themselves admin.
	•	The frontend shows only the pages and buttons a user's role allows.
3.3 Basics we expect
	•	No secrets in the repo. API keys and database passwords go in environment variables. Include a .env.example with variable names only.
	•	Friendly error messages when the LLM is slow or fails, instead of a crash.
	•	Code that someone else can read: sensible file names and structure.
4. Free deployment options
Host it anywhere free. If you are not sure where, Vercel (frontend) + Render (FastAPI) + Neon or Supabase (database) is a combination that works without a credit card at the time of writing. Free-tier rules change, so check each provider's current limits.
Part
Suggested (free)
Alternatives
Frontend
Vercel
Netlify, Cloudflare Pages, Render Static Site
Backend (FastAPI)
Render Free Web Service
Koyeb, Hugging Face Spaces (Docker)
Database
Neon or Supabase Postgres
MongoDB Atlas free tier, Render Postgres
Good to know about Render's free plan (Render docs):
	•	The service sleeps after 15 minutes idle and takes about a minute to wake on the next request.
	•	Its disk is wiped on restart, so store uploaded files and data in your database or a storage service, not on local disk.
	•	Free Render Postgres expires after 30 days, which is why Neon or Supabase is suggested for the database.
Before you submit, open your live app in a private/incognito window and log in with each demo account to make sure everything works.
5. Project A: PolicyDesk, a RAG document assistant
Build a web app where an admin uploads documents and logged-in users ask questions about them in plain English, getting answers drawn from those documents along with the source.
Example: an organisation uploads its HR and leave policies. A staff member asks "How many casual leaves do I get per year?" and gets a short answer plus the name of the document it came from.
5.1 Minimum it must do
	•	Two roles: Admin (uploads and manages documents, manages users) and User (asks questions).
	•	Upload: the admin uploads PDF or text documents, which are processed for search (chunking, embeddings, vector store: your choice of tools).
	•	Ask: users ask questions in a chat-style page and get answers based only on the uploaded documents.
	•	Source: each answer shows which document it came from.
	•	Honesty: if the answer isn't in the documents, the app says so instead of making one up.
Upload 2–3 sample documents to your live app so we can try it straight away. Note that Groq has no embedding models, so pick a separate free option for embeddings.
5.2 Going further (optional)
The list above is the minimum. Think like a product builder: what would make this genuinely useful? Well-built additional features are a strong plus and will be considered favourably in the evaluation. Some ideas, but your own ideas are just as welcome:
	•	Chat history, streaming answers, or showing the exact passage used
	•	Document-level access (some documents visible to admins only)
	•	Support for more file types, or summarising a whole document
	•	A feedback button (helpful / not helpful) on answers
List every extra feature you built in the README so we don't miss it.
6. Project B: TaskPilot, a small AI agent that manages tasks
Build a web app where users manage their to-do tasks by chatting with an AI agent, which decides which tool to call and actually changes the data in the database.
Example: a user types "Add a task to submit the monthly report by Friday", then "What's due this week?", then "Mark the report task as done." The agent calls the right tool each time and replies with what it did.
6.1 Minimum it must do
	•	Two roles: Admin (can see all users and all tasks) and User (manages only their own tasks).
	•	Agent with tools: the LLM uses tool/function calling (directly or through a framework) to add, list, update and delete tasks.
	•	Multi-step: a request like "Mark the report done and add a task to start the next one" triggers both actions.
	•	Safe by design: the backend, not the LLM, makes sure a user's tools only touch their own tasks.
	•	Task list page: a simple page showing the user's tasks, so changes made by the agent are visible.
6.2 Going further (optional)
The list above is the minimum. Think about what would make the agent more useful or more trustworthy. Well-built additional features are a strong plus and will be considered favourably in the evaluation. Some ideas, but your own ideas are just as welcome:
	•	Asking for confirmation before deleting or bulk changes
	•	Showing which tools the agent called for each reply
	•	Priorities, categories, reminders or a daily summary
	•	More tools, e.g. assigning a task to another user (admins only)
List every extra feature you built in the README so we don't miss it.
7. How we will evaluate
The main question is simple: does the deployed app do what the project's "Minimum it must do" list says?
Area
What we look for
Working end product
Live app works and covers the minimum list
AI feature quality
Correct, sourced answers (A), or the agent calls the right tools (B)
Login and roles
Roles enforced on the backend; users can't reach what they shouldn't
Code and README
Readable code, no secrets in the repo, a README we can follow
Going beyond the minimum with well-built features of your own, a polished interface or tests will strengthen your submission. Build the core first, then add to it.
Not evaluated: no live URL, a repo that doesn't match the live app, or code copied from another candidate.
If you pass this round, we will invite you to a short technical call to walk us through your code and the choices you made.
8. Submission, rules and FAQ
8.1 How to submit
Reply to the email that sent you this document within 48 hours, with the subject "AI Engineer Round 1 – [Your Full Name] – Project A" (or Project B), and paste this in the body:
Name: Project chosen: A (PolicyDesk) / B (TaskPilot) GitHub repo: Live frontend URL: Live backend URL: Demo logins (one per role): LLM used:
Please don't push commits after you submit.
8.2 AI coding tools
You may use AI coding assistants (Claude Code, Cursor, Copilot, ChatGPT and so on). Just make sure you understand your code well enough to explain it in the follow-up call.
8.3 FAQ
Do I have to use Groq? No. Use any free LLM API. Groq is only a suggestion.
Which database should I use? Any free hosted database. Postgres is recommended but not required.
Can I use LangChain, LangGraph or another framework? Yes.
My free backend sleeps and the first request is slow. Is that a problem? No. Mention it in the README.
I couldn't finish everything. Should I still submit? Yes. Submit what works, deployed, and list what's missing in the README.
Who do I contact with questions? Reply to the email that sent you this assignment.
Good luck. We look forward to seeing what you build.
— QuantumApps AI Engineering Team
