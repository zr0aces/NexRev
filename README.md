# NexRev

A high-performance, personal sales pipeline management system built for speed, privacy, and AI-assisted workflow.

NexRev is designed for individual account executives and sales professionals who need a fast, always-dark, and distraction-free environment to manage their daily sales activities. It combines a robust Kanban board with AI-driven summarization, Telegram notifications, and a premium mobile experience.

---

## 🚀 Key Features

| Feature | Description |
|---------|-------------|
| **Premium Mobile UX** | **[NEW]** Native-like mobile experience with bottom navigation, floating action buttons (FAB), and responsive master-detail views. |
| **Today Dashboard** | A centralized view of pending follow-ups with smart urgency indicators and high-impact metrics. |
| **Integrated Pipeline** | Manage your entire deal flow with instant search, stage filters, and streamlined navigation. |
| **Per-Opportunity Kanban** | A dedicated board for every account (To Do → Follow-ups → Done) with drag-and-drop support. |
| **AI Task Extraction** | **[NEW]** Instantly scan activity logs to extract and populate Kanban tasks automatically. |
| **AI Activity Summary** | Generate concise summaries of meeting notes and activity logs using local LLMs. |
| **SF Update Note** | Generate Salesforce-ready activity summaries reflecting developments since your last sync. |
| **Telegram Integration** | **[NEW]** Daily reminders at 8:30 AM for due/overdue tasks. Link your account via `/start` in the Telegram bot. |
| **Modern Iconography** | Fully integrated with **Lucide React** for a clean, professional, and consistent UI. |
| **Local-First Privacy** | All data is stored in a local SQLite database on your machine. |
| **AI Provider Flexibility** | Run AI features with Ollama (local), OpenRouter (cloud), or LiteLLM proxy using a unified backend interface. |
| **Manual Digest** | **[NEW]** Trigger the daily Telegram digest manually via CLI in production. |

---

## 🛠 Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Vanilla CSS (Premium Dark Theme), Lucide Icons.
- **Backend**: Node.js, Fastify 5, TypeScript.
- **Reverse Proxy**: Nginx (handling both frontend and backend).
- **Storage**: SQLite (single local database file).
- **Authentication**: JWT-based secure login with bcrypt hashing.
- **AI Engine**: LiteLLM-based unified integration (Ollama, OpenRouter, or LiteLLM proxy).
- **Deployment**: Docker Compose.

## 🗄 Data Storage

- Primary datastore: `data/nexrev.sqlite3`
- Legacy migration: legacy `data/*.md` opportunities and `data/secrets.yaml` users are auto-imported at startup when SQLite tables are empty.
- On-demand re-import: run `cd backend && npm run migrate:legacy` to import any missing legacy records without duplicating existing IDs/usernames.
- Cleanup behavior: once all legacy records are verified in SQLite, legacy `.md` files and `secrets.yaml` are deleted automatically.

Environment overrides:
- `DATA_DIR` sets the base data directory.
- `SQLITE_FILE` overrides the SQLite path directly.
- `SECRETS_FILE` is only used as a temporary legacy migration input path.

Startup telemetry:
- Backend logs the active SQLite schema version and legacy import counts at boot.

Backup and restore:
- Create backup: `cd backend && npm run db:backup`
- Restore backup: `cd backend && npm run db:restore`
- You can also run custom paths with: `node backend/scripts/db-backup-restore.mjs backup <file>` and `node backend/scripts/db-backup-restore.mjs restore <file>`

---

## 🚦 Quick Start

### Prerequisites
- Docker & Docker Compose.
- One AI provider configured: Ollama, OpenRouter, or LiteLLM proxy.

### 1. Setup Environment
```bash
cp .env.example .env
# Edit .env to set JWT_SECRET, TELEGRAM_BOT_TOKEN, and AI provider variables.
```

### 2. Pull AI Model
```bash
ollama pull llama3.2
```

### 3. Launch System
```bash
docker compose up -d --build
```
Access the application at **http://localhost:8088**.

Production notes:
- Set a **strong** `JWT_SECRET` (32+ characters). The backend now refuses to start in production with missing or placeholder secrets.
- Set `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN` for your real domain before enabling passkeys in production.
- Set `CORS_ORIGIN` to the exact browser origin(s) that should reach the API.

### 4. Initial Credentials
- **Username**: `admin`
- **Password**: `admin`
*Note: Change your password immediately in the Profile tab.*

---

## 📖 Documentation

- [**User Guide (English)**](frontend/public/docs/user_guide_en.html) - The master guide for all features and routines.
- [**คู่มือการใช้งาน (Thai)**](frontend/public/docs/user_guide_th.html) - คู่มือการใช้งานฉบับสมบูรณ์ภาษาไทย.
- [**Architecture**](docs/architecture.md) - Deep dive into system design and data models.
- [**API Reference**](docs/api.md) - Documentation of available endpoints.
- [**Configuration Guide**](docs/configuration.md) - Required and optional environment variables for local and production deployments.
- [**Docker Compose (GHCR)**](docs/docker-compose.yml) - Sample for deploying with pre-built images.
- [**Changelog**](CHANGELOG.md) - Release history and notable operational changes.

---

## 💾 Backup & Portability
NexRev uses a SQLite-first storage approach.
- **Primary backup**: copy `data/nexrev.sqlite3`.
- **Portability**: copy the `data/` folder to a new machine.

## 🔔 Manual Telegram Digest
If you need to manually trigger the daily digest for all linked Telegram users (e.g., for testing or if the cron failed), run:
```bash
docker compose exec backend node dist/scripts/send-daily-digest.js
```

## 🔢 Version Management & Releases
NexRev follows a standardized **YYYY.M.PATCH** versioning strategy (e.g., `2026.4.1`):
- **YYYY**: Release year.
- **M**: Release cycle (e.g., month or major iteration).
- **PATCH**: Incremental fixes within the same cycle.

### Versioning
- **Source of Truth:** `/VERSION` file in the root.
- **Syncing:** Run `node scripts/sync-version.mjs` to propagate version to `package.json` files and `.env`.
- **Runtime:** Backend reads `/VERSION` at boot; Frontend fetches version from `/api/health`.

### Release Workflow
1. **Update Version**: Use the release script from the root:
   ```bash
   node scripts/release.mjs
   ```
   The script updates `VERSION`, synchronizes package/environment versions, and verifies the sync before finishing.
2. **Runtime Access**:
  - The **Backend** reads the `VERSION` file at startup (either from the image or a volume mount) and exposes it via the `/api/health` endpoint.
  - The **Frontend** fetches this version dynamically from the API and displays it on the Login page and Profile panel, ensuring consistency with the running backend.
3. **Push Changes**:
   ```bash
   git push origin main --tags
   ```
4. **Automated Tagging**: If you push a change to the `VERSION` file without a tag, a GitHub Action will automatically create one for you.
5. **CI/CD Deployment**: Upon pushing a tag, the system automatically builds and publishes new Docker images to GHCR.

## ✅ Backend Validation

Run backend integration tests:
```bash
cd backend
npm install
npm test
```

Build both applications before release:
```bash
cd backend && npm run build
cd ../frontend && npm install && npm run build
```

## 🔒 Security Notes

- **JWT_SECRET**: Must be set to a long random string in production via `.env`. Placeholder or short secrets are rejected at startup.
- **Default credentials**: On first run, a default `admin/admin` account is created. Change the password immediately via the Profile tab or `node backend/scripts/manage-users.mjs passwd admin <newpassword>`. The default account is automatically removed once any other user account is defined.
- **Rate limiting**: Login is capped at 10 requests/minute. AI endpoints return `503` when the configured AI provider is unavailable or misconfigured.
- **Passkeys / WebAuthn**: In production, `WEBAUTHN_ORIGIN` must be HTTPS and must match `WEBAUTHN_RP_ID`. Invalid production config now fails fast at startup.
- **Docker deployment**: Compose samples now pin the nginx image and add service health checks so the reverse proxy waits for healthy backend/frontend services.
