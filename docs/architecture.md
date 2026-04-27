# Architecture

## Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite — no UI library, vanilla CSS (always-dark, orange accent) |
| **Backend** | Fastify 5, TypeScript, Node.js |
| **Storage** | Markdown files in `data/` via gray-matter |
| **Auth** | JWT (jsonwebtoken) + bcrypt (bcryptjs); credentials in `data/secrets.yaml` |
| **AI** | Local Ollama instance; configured via `OLLAMA_BASE_URL` and `OLLAMA_MODEL` |
| **Infrastructure** | Docker Compose, Nginx reverse proxy (port 8088) |

---

## Directory layout

```
NexRev/
├── frontend/
│   ├── src/
│   │   ├── App.tsx                   Root — auth state, tab routing, global opp list
│   │   ├── api.ts                    Typed fetch wrappers (auth token attached automatically)
│   │   ├── types.ts                  Shared TypeScript interfaces (Opportunity, KanbanColumn, …)
│   │   ├── styles.css                All styling — always-dark theme, orange (#F97316) accent
│   │   ├── utils.ts                  Date helpers (todayStr, fmtDate)
│   │   └── components/
│   │       ├── LoginPage.tsx         JWT sign-in screen
│   │       ├── Nav.tsx               Top nav, tab switcher, export / import / logout
│   │       ├── MetricsRow.tsx        4-card summary (active, pipeline value, overdue, won)
│   │       ├── TodayPanel.tsx        Daily digest sorted by urgency
│   │       ├── PipelinePanel.tsx     Search / filter / sort list + detail split view
│   │       ├── DetailPanel.tsx       Per-opp metadata, Kanban board, activity log, AI tools
│   │       ├── OppKanban.tsx         Three-column drag-and-drop Kanban (per opportunity)
│   │       ├── ActivityLogPanel.tsx  Global chronological activity feed
│   │       ├── OppModal.tsx          Add / edit opportunity form
│   │       └── Badge.tsx             Stage colour badge
│   ├── index.html
│   ├── vite.config.ts
│   └── Dockerfile
│
├── backend/
│   ├── src/
│   │   ├── server.ts                 Fastify setup + JWT auth middleware (onRequest hook)
│   │   ├── storage.ts                Markdown file CRUD via gray-matter
│   │   ├── auth.ts                   bcrypt verification, JWT sign/verify, secrets init
│   │   ├── types.ts                  Shared TypeScript interfaces
│   │   └── routes/
│   │       ├── auth.ts               POST /api/auth/login
│   │       ├── opportunities.ts      CRUD, activities, steps (Kanban column), bulk import
│   │       └── ai.ts                 /api/ai/summarize, /api/ai/sf-note (Ollama)
│   ├── scripts/
│   │   └── manage-users.mjs          User management CLI (add/passwd/delete/list)
│   └── Dockerfile
│
├── nginx/
│   └── nginx.conf                    /api/* → backend:3001, /* → frontend:3000
│
├── data/                             One .md per opportunity + secrets.yaml (gitignored)
├── docs/                             Project documentation
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Data model

Each opportunity is stored as `data/<id>.md` with YAML frontmatter and an optional free-text notes body:

```yaml
---
id: abc123def
name: Acme Corp
contact: Jane Smith
contactEmail: jane@acme.com
contactMobile: +1 555 000 0000
contactTitle: VP of Engineering
value: 50000
stage: Proposal
close: '2026-05-15'
followup: '2026-04-30'
nextStep: Send revised proposal
nextSteps:
  - text: Send revised proposal
    done: false
    column: todo
  - text: Book follow-up call
    done: false
    column: followup
  - text: Initial discovery call
    done: true
    column: done
activities:
  - date: '2026-04-25'
    raw: 'Raw meeting notes...'
    summary: 'Structured AI summary...'
    ai: true
createdAt: '2026-04-01T00:00:00.000Z'
updatedAt: '2026-04-27T12:00:00.000Z'
---

Free-form notes text here.
```

**`nextSteps[].column`** — `'todo' | 'followup' | 'done'` — drives the three-column Kanban board. `done` is derived from column and kept in sync:

- Setting `column: 'done'` → `done = true`
- Toggling `done = true` → `column = 'done'`
- Toggling `done = false` → `column = 'todo'` (unless it was `'followup'`, which is preserved)

**`activities[]`** — carry `raw`, `summary`, `date`, `ai` fields. No column field.

---

## Auth flow

1. `POST /api/auth/login` validates credentials against bcrypt hashes in `data/secrets.yaml` and returns a signed JWT (24 h expiry).
2. The frontend stores the token in `localStorage` and attaches it as `Authorization: Bearer <token>` on every request via `api.ts`.
3. The backend `onRequest` hook verifies the token on all routes except `/health`, `/api/auth/*`, and `OPTIONS`.
4. On a 401 response, `api.ts` clears the token and calls `onUnauthorized`, which flips React's `authenticated` state → the login screen renders.

Credentials (bcrypt hashes) live in `data/secrets.yaml`. Manage them with `backend/scripts/manage-users.mjs`.

---

## AI integration

AI calls flow: **browser → Fastify `/api/ai/*` → Ollama `/api/chat`**.

The browser never talks to Ollama directly. `OLLAMA_BASE_URL` and `OLLAMA_MODEL` are server-side env vars.

Before each AI request, the backend probes `GET /api/tags` (3 s timeout) to confirm Ollama is reachable. A clear `503` is returned if it isn't.

**Kanban context** — `buildKanbanContext(opp)` in `DetailPanel.tsx` groups `nextSteps` by column into `{ todo, followup, done }` string arrays. Both AI endpoints accept this object and append a formatted board state to the user message so the model has full deal context.

---

## Rendering

React state in `App.tsx` holds the canonical opportunity list. `api.ts` makes typed `fetch` calls to the Fastify backend. All mutations call `onRefresh()` which re-fetches the full list and propagates updates down through props.
