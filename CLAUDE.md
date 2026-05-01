# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

### Production (Docker)
```bash
cp .env.example .env   # set OLLAMA_BASE_URL, OLLAMA_MODEL, and JWT_SECRET
docker compose up --build
# Open http://localhost:8088
```

### Development (local)
```bash
# Terminal 1 — backend
cd backend && npm install && npm run dev

# Terminal 2 — frontend
cd frontend && npm install && npm run dev
# Open http://localhost:5173
```

## Stack

- **Frontend:** React 18, TypeScript, Vite — no UI library, vanilla CSS (always-dark, orange accent)
- **Backend:** Fastify 5, TypeScript, Node.js
- **Storage:** SQLite (better-sqlite3) — primary file: `data/nexrev.sqlite3`
- **Auth:** JWT (jsonwebtoken) + bcrypt (bcryptjs) — credentials stored in SQLite `users` table
- **Infrastructure:** Docker Compose, Nginx reverse proxy (port 8088)
- **AI:** Local Ollama instance called server-side; configured via `OLLAMA_BASE_URL` and `OLLAMA_MODEL` env vars
- **Notifications:** Telegram Bot (Daily reminders + account linking)

## Architecture

```
frontend/src/
  App.tsx                   Root — auth state, tab routing, global opp list
  api.ts                    Typed fetch wrappers (auth token attached automatically)
  types.ts                  Shared TypeScript interfaces (Opportunity, KanbanColumn, etc.)
  styles.css                All styling — always-dark theme, orange (#F97316) primary accent
  utils.ts                  Date helpers (todayStr, fmtDate)
  components/
    LoginPage.tsx           JWT sign-in screen
    Nav.tsx                 Top nav, tab switcher, export/import/logout
    MetricsRow.tsx          4-card summary row
    TodayPanel.tsx          Digest — pending follow-ups sorted by urgency
    PipelinePanel.tsx       List + detail split panel
    DetailPanel.tsx         Per-opportunity detail, Kanban board, activity log, AI tools
    OppKanban.tsx           Three-column drag-and-drop Kanban board (per opportunity)
    ActivityLogPanel.tsx    Global chronological activity feed
    OppModal.tsx            Add/edit opportunity modal
    Badge.tsx               Stage color badge

backend/src/
  server.ts                 Fastify setup + JWT auth middleware (onRequest hook)
  db.ts                     SQLite schema definition, initialization, and legacy migrations
  storage.ts                SQLite CRUD operations for opportunities, steps, and activities
  auth.ts                   bcrypt verification, JWT sign/verify, user management
  notifications.ts          Telegram bot long-polling (linking) and cron (daily reminders)
  types.ts                  Shared TypeScript interfaces
  routes/
    auth.ts                 POST /api/auth/login, /api/auth/password, Telegram linking
    opportunities.ts        CRUD, activities, steps (with Kanban column)
    ai.ts                   /api/ai/summarize, /api/ai/sf-note, /api/ai/extract-tasks
  scripts/
    manage-users.mjs        User management CLI (add/passwd/delete/list)
    db-backup-restore.mjs   SQLite database backup and restore utility

data/                       nexrev.sqlite3 database file (gitignored)
docs/                       Project documentation (guide, architecture, API reference)
nginx/nginx.conf            /api/* → backend:3001, /* → frontend:3000
docker-compose.yml
```

**Data model** — Relational schema in SQLite. `opportunities` is the root, with `next_steps` (Kanban) and `activities` linked by `opportunity_id`. `users` stores hashed credentials and `telegram_chat_id`.

**Auth flow** — backend `onRequest` hook verifies `Authorization: Bearer <token>` on all routes except `/health`, `/api/auth/login`, and `OPTIONS`. `api.ts` attaches the stored token automatically.

**Telegram** — Backend polls Telegram API for `/start <token>` to link Chat IDs to users. A cron job sends daily digests at 8:30 AM to linked users.

**AI integration** — AI calls go through the backend (`/api/ai/*`) to a local Ollama instance. `OLLAMA_BASE_URL` and `OLLAMA_MODEL` are env vars.

## Keyboard Shortcuts

- `Cmd/Ctrl + K` — Add new opportunity
- `Escape` — Close modal
- `Enter` (Kanban add input) — Commit new card
- `Escape` (Kanban add input) — Cancel add

## Tests & Linting

- **Backend Tests:** `cd backend && npm test` (Integration tests for SQLite persistence)
- **Linting:** Not configured.

