# Architecture & System Design

## Core Principles
1. **Local-First**: Data belongs to the user, stored in a local SQLite database file.
2. **AI-Enhanced**: Uses local LLMs (Ollama) to reduce manual data entry and CRM reporting friction.
3. **Speed**: Lightweight stack (React + Fastify) with no heavy UI libraries for instant responsiveness.

---

## Tech Stack

| Layer | Technology | Details |
|-------|------------|---------|
| **Frontend** | React 18, Vite | TypeScript, Vanilla CSS (GitHub-Dark inspired theme). |
| **Backend** | Fastify 5 | TypeScript, JWT Auth, bcrypt hashing. |
| **Storage** | SQLite | Uses `better-sqlite3`; primary file is `data/nexrev.sqlite3`. |
| **AI** | Ollama | Integrates via REST API with `llama3.2` (default). |
| **Proxy** | Nginx | Reverse proxy for routing and service orchestration. |

---

## Key Data Models

### Opportunity (`Opportunity` interface)
Stored as an aggregate across relational tables:
- `opportunities`: core metadata (stage, value, contact fields, notes, dates)
- `next_steps`: ordered Kanban tasks linked by `opportunity_id`
- `activities`: activity feed linked by `opportunity_id`

Key integrity rules:
- `opportunities.id` is the primary key.
- `next_steps` and `activities` have foreign keys with `ON DELETE CASCADE`.
- `stage`, `column_name`, and boolean flags are constrained with `CHECK` rules.
- Unique ordering per opportunity is enforced by `UNIQUE(opportunity_id, sort_order)`.

Key indexes:
- opportunities: stage, followup_date, updated_at, name
- next_steps: (opportunity_id, sort_order), (opportunity_id, column_name, done)
- activities: (opportunity_id, activity_date)

Operational metadata:
- `app_meta` stores schema metadata (currently `schema_version`).
- Server startup logs schema version and legacy migration import counts.

### Kanban Steps (`NextStep` interface)
- `text`: Description of the task.
- `column`: `todo` | `followup` | `done`.
- Derived `done` state: If `column === 'done'`, `done` is `true`.

### Activity Log (`Activity` interface)
- `raw`: Original input.
- `summary`: AI-generated or manual summary.
- `sf`: Boolean flag indicating if this was a Salesforce update note.

---

## AI Workflows

### Task Extraction (`/api/ai/extract-tasks`)
Scans recent activity logs and returns a JSON object with categorized tasks. The frontend then merges these into the existing Kanban board while preventing duplicates.

### CRM Note Generation (`/api/ai/sf-note`)
Identifies the index of the last activity marked as `sf: true`. It then slices the activity log from that point forward to ensure the generated note only covers new ground.

---

## Authentication Flow
1. **Login**: User provides credentials. Backend verifies against SQLite `users` table.
2. **Token**: Returns a signed JWT containing the `username`.
3. **Persistence**: Frontend stores the token and username in `localStorage`.
4. **Authorized Requests**: All API calls (except `/health` and `/auth/login`) must include the Bearer token.

## Telegram Notifications
1. **Account Linking**:
   - User requests a link token via `/api/auth/telegram/link-token`.
   - User clicks a link or sends `/start <token>` to the bot.
   - Backend (long-polling) detects the token and captures the `chat_id`.
   - Frontend polls `/api/auth/telegram/poll-link` to confirm success.
   - The `telegram_chat_id` is persisted in the `users` table.
2. **Daily Reminders**:
   - A `node-cron` job runs daily at 8:30 AM.
   - Filters opportunities for those due today or overdue.
   - Sends a formatted HTML "Daily Digest" message to all users with a linked `telegram_chat_id`.

## Legacy Import
- Startup migration imports legacy Markdown/YAML data when SQLite tables are empty.
- On-demand migration command: `cd backend && npm run migrate:legacy`
- After all legacy records are verified in SQLite, legacy `.md` opportunity files and `secrets.yaml` are removed automatically to keep a single source of truth.

## Backup and Restore
- Backup command: `cd backend && npm run db:backup`
- Restore command: `cd backend && npm run db:restore`
- Backups are generated via SQLite `VACUUM INTO` for consistent snapshots.

## Application Versioning & Release Strategy
NexRev uses a centralized versioning strategy to ensure consistency across the stack:
- **Format**: Uses `YYYY.M.PATCH` (e.g., `2026.4.1`) for clear temporal and iterative tracking.
- **Central Definition**: The version is defined in a single [`VERSION`](../VERSION) file at the project root.
- **Propagation**: A synchronization script (`scripts/sync-version.mjs`) propagates this version to:
  - `backend/package.json`
  - `frontend/package.json`
  - `.env` and `.env.example` (as `NEXREV_VERSION` for Docker image tagging)
- **Standardized Release**:
  - `scripts/release.mjs` handles the interactive update and local tagging.
  - GitHub Actions (`tag-version.yml`) ensure that any change to `VERSION` in the `main` branch is captured as a git tag.
  - Image builds (`release.yml`) are triggered by release publication, using the version tag for image identification.
- **Runtime Access**:
  - The **Backend** reads the `VERSION` file at startup (either from the image or a volume mount) and exposes it via the `/api/health` endpoint.
  - The **Frontend** fetches this version dynamically from the API and displays it on the Login page and Profile panel, ensuring consistency with the running backend.
