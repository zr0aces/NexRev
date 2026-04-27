# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

### Production (Docker)
```bash
cp .env.example .env   # add ANTHROPIC_API_KEY and JWT_SECRET
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
- **Backend:** Fastify 5, TypeScript, Node.js — data stored as Markdown files in `data/`
- **Auth:** JWT (jsonwebtoken) + bcrypt (bcryptjs) — credentials in `data/secrets.yaml`
- **Infrastructure:** Docker Compose, Nginx reverse proxy (port 8088)
- **AI:** Anthropic Claude API called server-side; key set via `ANTHROPIC_API_KEY` env var

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
  storage.ts                Markdown file CRUD via gray-matter
  auth.ts                   bcrypt credential verification, JWT sign/verify, secrets init
  types.ts                  Shared TypeScript interfaces
  routes/
    auth.ts                 POST /api/auth/login
    opportunities.ts        CRUD, activities, steps (with Kanban column), bulk import
    ai.ts                   /api/ai/summarize, /api/ai/sf-note (Kanban-context aware)
  scripts/
    manage-users.mjs        User management CLI (add/passwd/delete/list)

data/                       One .md file per opportunity + secrets.yaml (gitignored)
nginx/nginx.conf            /api/* → backend:3001, /* → frontend:3000
docker-compose.yml
```

**Data model** — each opportunity is `data/<id>.md` with YAML frontmatter. `nextSteps[]` items carry a `column: 'todo' | 'followup' | 'done'` field that drives the Kanban board. Activities carry `raw`, `summary`, `date`, `ai` fields (no column).

**Auth flow** — backend `onRequest` hook verifies `Authorization: Bearer <token>` on all routes except `/health`, `/api/auth/*`, and `OPTIONS`. `api.ts` attaches the stored token automatically; on 401 it calls `onUnauthorized` which clears the token and triggers the login screen.

**Kanban context** — `buildKanbanContext(opp)` in DetailPanel.tsx groups `nextSteps` by column into `{ todo, followup, done }` string arrays, which are passed to both AI endpoints so Claude has full deal context.

**done/column sync** — `PATCH /steps/:index`: if `column` is set, `done` is derived from `column === 'done'`; if only `done` is toggled, column updates to `'done'` or reverts to `'todo'` (preserving `'followup'`).

**Rendering** — React state in App.tsx holds the opportunity list. `api.ts` makes fetch calls to the Fastify backend. Mutations call `onRefresh()` which re-fetches the full list.

**AI integration** — AI calls go through the backend (`/api/ai/*`). The API key is an env var, never sent to the browser.

## Keyboard Shortcuts

- `Cmd/Ctrl + K` — Add new opportunity
- `Escape` — Close modal
- `Enter` (Kanban add input) — Commit new card
- `Escape` (Kanban add input) — Cancel add

## No Tests or Linting

There is no test suite and no linter configured. Manual browser testing is the only verification path.
