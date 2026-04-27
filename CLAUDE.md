# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

### Production (Docker)
```bash
cp .env.example .env   # add ANTHROPIC_API_KEY
docker compose up --build
# Open http://localhost
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

- **Frontend:** React 18, TypeScript, Vite — no UI library, vanilla CSS
- **Backend:** Fastify 5, TypeScript, Node.js — data stored as Markdown files in `data/`
- **Infrastructure:** Docker Compose, Nginx reverse proxy (port 80)
- **AI:** Anthropic Claude API called server-side; key set via `ANTHROPIC_API_KEY` env var

## Architecture

```
frontend/src/
  App.tsx                   Root — tab state, opportunity list, modal control
  api.ts                    Typed fetch wrappers for all backend endpoints
  types.ts                  Shared TypeScript interfaces (Opportunity, Stage, etc.)
  styles.css                All styling — CSS custom properties, light/dark mode
  components/
    Nav.tsx                 Top nav, export/import functions
    MetricsRow.tsx          4-card summary row
    TodayPanel.tsx          Digest — pending follow-ups sorted by urgency
    PipelinePanel.tsx       List + detail split panel
    ActivityLogPanel.tsx    Global activity timeline
    DetailPanel.tsx         Per-opportunity detail, checklist, AI tools
    OppModal.tsx            Add/edit modal
    Badge.tsx               Stage color badge

backend/src/
  server.ts                 Fastify server setup + CORS
  storage.ts                Markdown file CRUD via gray-matter
  types.ts                  Opportunity interface
  routes/
    opportunities.ts        CRUD, activities, steps, bulk import
    ai.ts                   /api/ai/summarize, /api/ai/sf-note

data/                       One .md file per opportunity (gitignored)
nginx/nginx.conf            /api/* → backend:3001, /* → frontend:3000
docker-compose.yml
```

**Data model** — each opportunity is `data/<id>.md` with YAML frontmatter (all fields including nextSteps[] and activities[]) and a free-text body (notes).

**Rendering** — React state in App.tsx holds the opportunity list. `api.ts` makes fetch calls to the Fastify backend. Mutations call `onRefresh()` which re-fetches the full list.

**AI integration** — AI calls go through the backend (`/api/ai/*`). The API key is an env var, never sent to the browser.

## Keyboard Shortcuts

- `Cmd/Ctrl + K` — Add new opportunity
- `Escape` — Close modal

## No Tests or Linting

There is no test suite and no linter configured. Manual browser testing is the only verification path.
