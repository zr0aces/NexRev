# NexRev

A high-performance, personal sales pipeline management system built for speed, privacy, and AI-assisted workflow.

NexRev is designed for individual account executives and sales professionals who need a fast, always-dark, and distraction-free environment to manage their daily sales activities. It combines a robust Kanban board with AI-driven summarization and Salesforce integration.

---

## 🚀 Key Features

| Feature | Description |
|---------|-------------|
| **Redesigned Today View** | A 3-column grid of cards showing pending follow-ups with smart urgency indicators (Red = Overdue, Amber = Due soon). |
| **Integrated Pipeline** | Manage your entire deal flow with search, stage filters, and instant navigation from the Today view. |
| **Per-Opportunity Kanban** | A dedicated board for every account (To Do → Follow-ups → Done) with drag-and-drop support. |
| **AI Task Extraction** | **[NEW]** Instantly scan your recent meeting notes to extract and populate Kanban tasks automatically. |
| **SF Update Note** | Generate Salesforce-ready activity summaries that strictly reflect developments since your last sync. |
| **One Opportunity Per Client** | Enforces a clean pipeline by mapping exactly one opportunity to each unique account. |
| **Local-First Privacy** | All data is stored in human-readable Markdown files on your machine. No cloud database required. |
| **AI Powered by Ollama** | Leverage local LLMs (like Llama 3.2) for summarization and CRM note generation. |

---

## 🛠 Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Vanilla CSS (Premium Dark Theme).
- **Backend**: Node.js, Fastify 5, TypeScript.
- **Storage**: Markdown files with YAML frontmatter (via `gray-matter`).
- **Authentication**: JWT-based secure login with bcrypt password hashing.
- **AI Engine**: Ollama (Local LLM Integration).
- **Deployment**: Docker Compose with Nginx reverse proxy.

---

## 🚦 Quick Start

### Prerequisites
- Docker & Docker Compose.
- [Ollama](https://ollama.com) installed and running locally.

### 1. Setup Environment
```bash
cp .env.example .env
# Edit .env to set OLLAMA_BASE_URL, OLLAMA_MODEL, and JWT_SECRET
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
| Username | Password |
|----------|----------|
| `admin`  | `admin`  |
*Note: Change your password immediately using the CLI tools or by editing `data/secrets.yaml` (hashed).*

---

## 📖 Documentation

- [**User Guide (English)**](docs/user_guide_en.md) - Simple steps to master your pipeline.
- [**คู่มือการใช้งาน (Thai)**](docs/user_guide_th.md) - ขั้นตอนการใช้งานภาษาไทย.
- [**Daily Usage Guide**](docs/guide.md) - Detailed workflow and best practices.
- [**Architecture**](docs/architecture.md) - Deep dive into system design and data models.
- [**API Reference**](docs/api.md) - Full documentation of available endpoints.

---

## 💾 Backup & Portability
NexRev uses a **Markdown-first** storage approach. Your data lives in `data/*.md`.
- **Export**: Generate an Obsidian-compatible `.md` snapshot.
- **Backup/Restore**: Save and load full JSON snapshots of your pipeline.
- **Portability**: Simply copy the `data/` folder to a new machine to migrate your entire system.
