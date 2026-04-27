# NexRev

A full-stack personal sales pipeline tool for daily account management. React + TypeScript frontend, Fastify backend, Markdown-file storage, Docker Compose with Nginx.

---

## What it does

| Feature | Description |
|---------|-------------|
| **Today digest** | Daily view of pending follow-ups with urgency indicators (overdue / due today / due soon) |
| **Pipeline** | Manage opportunities with search, stage filter, sort, and split-panel detail view |
| **Per-opportunity Kanban** | Three-column board (To Do → Follow-ups → Done) with drag-and-drop and inline card creation |
| **Activity log** | Meeting notes, raw or AI-summarised, per opportunity and across the full pipeline |
| **AI summarization** | Paste raw notes → Claude returns a structured summary with Kanban context awareness |
| **Salesforce note generator** | One-click CRM-ready activity note, enriched with the current board state |
| **Authentication** | JWT-based login; credentials stored in `data/secrets.yaml`; user management CLI |
| **Export / backup** | Obsidian-compatible `.md` export and portable JSON backup/restore |

---

## Quick start (Docker)

### Prerequisites
- Docker + Docker Compose
- [Ollama](https://ollama.com) running locally with a model pulled (AI features are optional — the app works without it)

### 1 — Configure

```bash
cp .env.example .env
# Set OLLAMA_BASE_URL, OLLAMA_MODEL, and JWT_SECRET in .env
```

### 2 — Start

```bash
docker compose up --build
```

Open **http://localhost:8088** in your browser.

### 3 — First login

On first start the backend auto-creates a default user:

| Username | Password |
|----------|----------|
| `admin`  | `admin`  |

**Change it immediately** (see [User management](#user-management)).

---

## Local development (no Docker)

```bash
# Terminal 1 — backend
cd backend
npm install
npm run dev          # Fastify on http://localhost:3001

# Terminal 2 — frontend
cd frontend
npm install
npm run dev          # Vite on http://localhost:5173
```

The Vite dev server proxies `/api` to `localhost:3001`.

---

## User management

Users are stored as bcrypt hashes in `data/secrets.yaml`. Use the CLI to manage them:

```bash
# Add a user
node backend/scripts/manage-users.mjs add <username> <password>

# Change a password
node backend/scripts/manage-users.mjs passwd <username> <newpassword>

# List users
node backend/scripts/manage-users.mjs list

# Remove a user
node backend/scripts/manage-users.mjs delete <username>
```

The `JWT_SECRET` env var controls token signing. Set a strong random value in production:

```bash
JWT_SECRET=<64-char-random-string>
```

---

## AI features

AI summarization and Salesforce note generation are powered by a local [Ollama](https://ollama.com) instance — no cloud API key required.

### Setup

```bash
# 1. Install Ollama: https://ollama.com
# 2. Pull a model
ollama pull llama3.2

# 3. Set in .env
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3.2
```

When running via Docker Compose on Linux, `host.docker.internal` is resolved automatically via `extra_hosts`. For local dev (no Docker), use `http://localhost:11434`.

**Kanban context** — when generating a summary or SF note, the current board state (To Do / Follow-ups / Done items) is automatically included in the prompt so the model has full deal context.

**Model choice** — any model available in your Ollama instance works. Recommended: `llama3.2`, `mistral`, or `qwen2.5`.

---

## Architecture

```
nexrev/
├── frontend/
│   └── src/
│       ├── App.tsx               Root — auth state, tab routing, global opp list
│       ├── api.ts                Typed fetch wrappers (auth token attached automatically)
│       ├── types.ts              Shared TypeScript interfaces
│       ├── styles.css            All styling — dark theme, orange accent
│       └── components/
│           ├── LoginPage.tsx     JWT sign-in screen
│           ├── Nav.tsx           Top nav, tab switcher, export / import / logout
│           ├── MetricsRow.tsx    4-card summary (active, pipeline value, overdue, won)
│           ├── TodayPanel.tsx    Daily digest sorted by urgency
│           ├── PipelinePanel.tsx Search / filter / sort list + detail split view
│           ├── DetailPanel.tsx   Per-opp metadata, Kanban board, activity log, AI tools
│           ├── OppKanban.tsx     Three-column drag-and-drop Kanban (per opportunity)
│           ├── ActivityLogPanel.tsx  Global chronological activity feed
│           ├── OppModal.tsx      Add / edit opportunity form
│           └── Badge.tsx         Stage colour badge
│
├── backend/
│   ├── src/
│   │   ├── server.ts             Fastify setup + JWT auth middleware
│   │   ├── storage.ts            Markdown file CRUD via gray-matter
│   │   ├── auth.ts               bcrypt credential verification, JWT sign/verify
│   │   ├── types.ts              Shared TypeScript interfaces
│   │   └── routes/
│   │       ├── auth.ts           POST /api/auth/login
│   │       ├── opportunities.ts  CRUD, activities, steps (with Kanban column), import
│   │       └── ai.ts             Summarize + SF note (Kanban-context aware)
│   └── scripts/
│       └── manage-users.mjs      User management CLI
│
├── nginx/nginx.conf              /api/* → backend:3001, /* → frontend:3000
├── data/                         One .md per opportunity + secrets.yaml (gitignored)
├── docker-compose.yml
├── .env.example
├── README.md
└── GUIDE.md
```

### Data model

Each opportunity is stored as `data/<id>.md` with YAML frontmatter:

```markdown
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

### API reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Authenticate → returns JWT |
| `GET` | `/api/opportunities` | List all opportunities |
| `POST` | `/api/opportunities` | Create opportunity |
| `PUT` | `/api/opportunities/:id` | Update opportunity |
| `DELETE` | `/api/opportunities/:id` | Delete opportunity |
| `POST` | `/api/import` | Bulk import from JSON backup |
| `POST` | `/api/opportunities/:id/activities` | Add activity log entry |
| `POST` | `/api/opportunities/:id/steps` | Add Kanban card (with `column`) |
| `PATCH` | `/api/opportunities/:id/steps/:index` | Move card (`column`) or toggle done |
| `DELETE` | `/api/opportunities/:id/steps/:index` | Remove card |
| `POST` | `/api/ai/summarize` | AI summarize notes (+ optional Kanban context) |
| `POST` | `/api/ai/sf-note` | Generate Salesforce note (+ optional Kanban context) |

All endpoints except `/api/auth/login` and `/health` require `Authorization: Bearer <token>`.

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Add new opportunity |
| `Escape` | Close modal |
| `Enter` (Kanban add input) | Commit new card |
| `Escape` (Kanban add input) | Cancel add |

---

## Backup and restore

- **Export** — Markdown snapshot of the full pipeline (Obsidian-compatible)
- **Backup JSON** — portable JSON array of all opportunities
- **Import JSON** — merge from a backup file (existing IDs skipped)

Raw data lives in `data/*.md` — human-readable, can be synced with any file tool.

**Moving to another machine:**

1. Copy the `data/` directory (contains `.md` files + `secrets.yaml`)
2. Set the same `JWT_SECRET` in the new `.env`
3. `docker compose up --build` on the new machine — data is immediately available
