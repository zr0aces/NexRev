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
| **AI summarization** | Paste raw notes → local Ollama model returns a structured summary with Kanban context |
| **Salesforce note generator** | One-click CRM-ready activity note, enriched with the current board state |
| **Authentication** | JWT-based login; credentials stored in `data/secrets.yaml`; user management CLI |
| **Export / backup** | Obsidian-compatible `.md` export and portable JSON backup/restore |

---

## Quick start (Docker)

### Prerequisites
- Docker + Docker Compose
- [Ollama](https://ollama.com) running locally with a model pulled (AI features are optional)

### 1 — Configure

```bash
cp .env.example .env
# Edit .env — set OLLAMA_BASE_URL, OLLAMA_MODEL, and JWT_SECRET
```

### 2 — Pull an AI model (optional)

```bash
ollama pull llama3.2
```

### 3 — Start

```bash
docker compose up --build
```

Open **http://localhost:8088** in your browser.

### 4 — First login

| Username | Password |
|----------|----------|
| `admin`  | `admin`  |

Change the default password immediately — see [User management](docs/guide.md#user-management).

---

## Local development (no Docker)

```bash
# Terminal 1 — backend
cd backend && npm install && npm run dev   # Fastify on :3001

# Terminal 2 — frontend
cd frontend && npm install && npm run dev  # Vite on :5173
```

The Vite dev server proxies `/api` to `localhost:3001`. Use `OLLAMA_BASE_URL=http://localhost:11434` for local dev.

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/guide.md](docs/guide.md) | Daily usage guide — routine, Kanban, AI, Salesforce workflow, troubleshooting |
| [docs/architecture.md](docs/architecture.md) | Stack, directory layout, data model, auth flow, AI integration |
| [docs/api.md](docs/api.md) | Full API reference with request/response examples |

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://host.docker.internal:11434` | Ollama instance URL |
| `OLLAMA_MODEL` | `llama3.2` | Model to use for AI features |
| `JWT_SECRET` | *(required)* | Token signing secret — use a long random string |
| `DATA_DIR` | `./data` | Directory for opportunity `.md` files |
| `PORT` | `3001` | Backend listen port |

---

## Backup and restore

- **Export** (nav) — Obsidian-compatible `.md` snapshot of the full pipeline
- **Backup** (nav) — portable JSON array of all opportunities
- **Import** (nav) — merge from a backup file (existing IDs skipped)

Raw data lives in `data/*.md` — human-readable, version-controllable, portable.

**Moving to another machine:**
1. Copy the `data/` directory
2. Set the same `JWT_SECRET` in the new `.env`
3. `docker compose up --build`
