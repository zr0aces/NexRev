# Architecture & System Design

## Core Principles
1. **Local-First**: Data belongs to the user, stored in human-readable Markdown.
2. **AI-Enhanced**: Uses local LLMs (Ollama) to reduce manual data entry and CRM reporting friction.
3. **Speed**: Lightweight stack (React + Fastify) with no heavy UI libraries for instant responsiveness.

---

## Tech Stack

| Layer | Technology | Details |
|-------|------------|---------|
| **Frontend** | React 18, Vite | TypeScript, Vanilla CSS (GitHub-Dark inspired theme). |
| **Backend** | Fastify 5 | TypeScript, JWT Auth, bcrypt hashing. |
| **Storage** | Markdown / YAML | Uses `gray-matter` to parse metadata from `.md` files in `/data`. |
| **AI** | Ollama | Integrates via REST API with `llama3.2` (default). |
| **Proxy** | Nginx | Reverse proxy for routing and service orchestration. |

---

## Key Data Models

### Opportunity (`Opportunity` interface)
Stored as a single Markdown file.
- **Frontmatter**: Metadata like stage, value, contact info, and Kanban steps.
- **Body**: Free-form initial notes or context.

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
1. **Login**: User provides credentials. Backend verifies against `data/secrets.yaml`.
2. **Token**: Returns a signed JWT containing the `username`.
3. **Persistence**: Frontend stores the token and username in `localStorage`.
4. **Authorized Requests**: All API calls (except `/health` and `/auth/login`) must include the Bearer token.
