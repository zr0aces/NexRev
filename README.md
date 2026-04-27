# Sales Dashboard

A full-stack personal sales dashboard for daily account management. React + TypeScript frontend, Fastify backend, Markdown-file storage, Docker Compose with Nginx.

## What it does

- **Today view** — daily digest of pending follow-ups, overdue flags, and key metrics
- **Pipeline view** — manage opportunities with search, stage filter, sort, and a detail panel
- **Per-opportunity detail** — meeting notes, next-steps checklist, full activity history
- **AI summarization** — paste raw meeting notes → Claude returns a structured summary
- **Salesforce update generator** — one-click CRM-ready activity note to copy-paste
- **Export to Markdown** — Obsidian-compatible `.md` export of your full pipeline
- **JSON backup / import** — portable backup you can restore on any machine

---

## Quick start (Docker)

### Prerequisites
- Docker + Docker Compose
- An Anthropic API key (for AI features — optional)

### Run

```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
docker compose up --build
```

Open **http://localhost** in your browser.

Opportunity data is persisted in the `data/` directory (Docker volume mount — survives container restarts).

---

## Local development (no Docker)

### Backend

```bash
cd backend
npm install
npm run dev        # starts Fastify on http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # starts Vite dev server on http://localhost:5173
```

The Vite dev server proxies `/api` to `localhost:3001`, so both must be running.

---

## AI features

AI summarization and Salesforce note generation are powered by the Anthropic Claude API.

Set your key in `.env` before starting the stack:

```
ANTHROPIC_API_KEY=sk-ant-...
```

The key is used server-side only — it is never sent to the browser.

**Cost:** typically under $0.01 per summary. See [Anthropic pricing](https://anthropic.com/pricing).

---

## Architecture

```
sales-dashboard/
├── frontend/               React + TypeScript app (Vite)
│   └── src/
│       ├── App.tsx         Root component — tab routing, global state
│       ├── api.ts          Typed fetch wrappers for all API endpoints
│       ├── types.ts        Shared TypeScript interfaces
│       ├── styles.css      All styling (light + dark via CSS custom properties)
│       └── components/
│           ├── Nav.tsx
│           ├── MetricsRow.tsx
│           ├── TodayPanel.tsx
│           ├── PipelinePanel.tsx
│           ├── ActivityLogPanel.tsx
│           ├── DetailPanel.tsx
│           ├── OppModal.tsx
│           └── Badge.tsx
├── backend/                Fastify API server (Node.js + TypeScript)
│   └── src/
│       ├── server.ts
│       ├── storage.ts      Markdown file read/write via gray-matter
│       ├── types.ts
│       └── routes/
│           ├── opportunities.ts   CRUD + activities + steps + import
│           └── ai.ts              Summarize + SF note endpoints
├── nginx/
│   └── nginx.conf          Reverse proxy — /api → backend, / → frontend
├── data/                   Markdown files (one per opportunity, gitignored)
├── docker-compose.yml
├── .env.example
├── README.md
└── GUIDE.md
```

### Data model

Each opportunity is stored as a Markdown file at `data/<id>.md`:

```markdown
---
id: abc123def
name: Acme Corp
contact: Jane Smith
value: 50000
stage: Proposal
close: '2026-05-15'
followup: '2026-04-30'
nextStep: Send revised proposal
nextSteps:
  - text: Send revised proposal
    done: false
activities:
  - date: '2026-04-25'
    raw: 'Raw meeting notes...'
    summary: 'Structured summary...'
    ai: true
createdAt: '2026-04-01T00:00:00.000Z'
updatedAt: '2026-04-27T12:00:00.000Z'
---

Free-form notes text here.
```

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/opportunities` | List all |
| `POST` | `/api/opportunities` | Create |
| `PUT` | `/api/opportunities/:id` | Update |
| `DELETE` | `/api/opportunities/:id` | Delete |
| `POST` | `/api/import` | Bulk import from JSON backup |
| `POST` | `/api/opportunities/:id/activities` | Add activity |
| `POST` | `/api/opportunities/:id/steps` | Add next step |
| `PATCH` | `/api/opportunities/:id/steps/:index` | Toggle step |
| `DELETE` | `/api/opportunities/:id/steps/:index` | Remove step |
| `POST` | `/api/ai/summarize` | AI summarize raw notes |
| `POST` | `/api/ai/sf-note` | Generate Salesforce note |

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Add new opportunity |
| `Escape` | Close modal |
| `Enter` (checklist input) | Add next step |

---

## Backup and restore

- **Export JSON** (Backup JSON button) — downloads all opportunities as a JSON file
- **Import JSON** (Import JSON button) — merges opportunities from a backup (existing IDs skipped)
- **Export .md** — Obsidian-compatible Markdown snapshot of your full pipeline

Data also lives directly in `data/*.md` — these files are human-readable and can be backed up with any file sync tool.
