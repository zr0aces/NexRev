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
| **AI Task Extraction** | Instantly scan meeting notes to extract and populate Kanban tasks automatically. |
| **SF Update Note** | Generate Salesforce-ready activity summaries reflecting developments since your last sync. |
| **Telegram Integration** | Receive daily reminders at 8:30 AM and link your account instantly with one click. |
| **Modern Iconography** | Fully integrated with **Lucide React** for a clean, professional, and consistent UI. |
| **Local-First Privacy** | All data is stored in a local SQLite database on your machine. |
| **AI Powered by Ollama** | Leverage local LLMs (like Llama 3.2) for private, on-device intelligence. |

---

## 🛠 Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Vanilla CSS (Premium Dark Theme), Lucide Icons.
- **Backend**: Node.js, Fastify 5, TypeScript.
- **Reverse Proxy**: Nginx (handling both frontend and backend).
- **Storage**: SQLite (single local database file).
- **Authentication**: JWT-based secure login with bcrypt hashing.
- **AI Engine**: Ollama (Local LLM Integration).
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
- [Ollama](https://ollama.com) installed and running locally.

### 1. Setup Environment
```bash
cp .env.example .env
# Edit .env to set TELEGRAM_BOT_TOKEN, OLLAMA_BASE_URL, etc.
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
- [**Docker Compose (GHCR)**](docs/docker-compose.yml) - Sample for deploying with pre-built images.

---

## 💾 Backup & Portability
NexRev uses a SQLite-first storage approach.
- **Primary backup**: copy `data/nexrev.sqlite3`.
- **Portability**: copy the `data/` folder to a new machine.

## ✅ Backend Validation

Run backend integration tests:
```bash
cd backend
npm test
```
