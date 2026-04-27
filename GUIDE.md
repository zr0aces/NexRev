# NexRev — Daily Usage Guide

A practical, step-by-step guide to using NexRev as your daily sales operating system.

---

## Setup

### First run

```bash
cp .env.example .env
# Set OLLAMA_BASE_URL and OLLAMA_MODEL in .env (needed for AI features)
docker compose up --build
```

Open **http://localhost:8088**. On first start the backend auto-creates a default login:

| Username | Password |
|----------|----------|
| `admin`  | `admin`  |

**Change it immediately** using the user management CLI (see [User management](#user-management)).

### Updating

```bash
docker compose down
git pull
docker compose up --build
```

Your data in `data/` is unaffected.

---

## Signing in

Open the app and enter your username and password at the sign-in screen. Your session is stored in the browser — you stay signed in until you click **Sign out** in the nav or your token expires (24 hours).

---

## Your daily routine (15–20 min)

### Morning: Plan your day

1. Sign in → open the **Today** tab
2. Scan the digest — red = overdue, amber = due today or soon
3. For each item, click **View** to jump to the detail panel
4. Review the Kanban board and update the follow-up date as needed
5. Glance at the 4 metric cards to orient yourself on pipeline health

### During the day: Log everything

After every call, meeting, or email exchange — open the relevant opportunity and log it.

**Quick note:**
1. Go to **Pipeline** → click your account
2. Paste notes into the text area in the detail panel
3. Click **Log note** — saved instantly with today's date

**AI summarize (recommended for meetings):**
1. Paste raw notes — bullet points, stream of consciousness, anything
2. Click **✨ AI summarize**
3. Claude returns a clean structure: key points, decisions, action items
4. The current Kanban board state is automatically included as context
5. The summary is saved to the activity history automatically

> You don't need clean notes. Paste exactly what you have — messy, abbreviated, partial sentences are fine.

### After logging: Update Salesforce

1. After logging 1–3 recent activities, click **▪ SF update note**
2. Claude generates a Salesforce-ready activity note (date, type, summary, next step)
3. The current Kanban board is included as context — the note reflects your real deal state
4. Copy and paste directly into Salesforce

### End of day: Export

1. Click **Export** in the nav — saves a full `.md` snapshot (Obsidian-compatible)
2. Click **Backup** weekly for a portable JSON backup

---

## Managing opportunities

### Add a new opportunity
- Click **+ Add Opportunity** or press `Cmd/Ctrl + K`
- Required: Account name, contact email, contact mobile, contact title
- Recommended: Stage, Contact name, Follow-up date, Next step
- The follow-up date drives the Today digest — always set one

### Edit an opportunity
- In the Pipeline tab, click an account to open the detail panel
- Click **Edit** to modify stage, close date, follow-up, contact fields, or notes

### Delete an opportunity
- Open the detail panel → click **Delete** (cannot be undone)

---

## Kanban board (per opportunity)

Each opportunity has a three-column Kanban board in its detail panel:

| Column | Purpose |
|--------|---------|
| **To Do** | Actions not yet started |
| **Follow-ups** | Items waiting on a response or scheduled for later |
| **Done** | Completed items |

### Adding cards
- Click **+ Add** at the bottom of any column
- Type your card text and press **Enter** to save — the input stays open for rapid entry
- Press **Escape** to close the input

### Moving cards
- Drag a card to any column — drop it anywhere in the column or onto the empty area
- The card updates instantly

### Completing cards
- Cards moved to **Done** are marked as complete automatically
- Moving a card back out of **Done** marks it incomplete

### Removing cards
- Hover over a card to reveal the **×** button, then click to remove

**Kanban context in AI** — when you click **✨ AI summarize** or **▪ SF update note**, the full board state (all three columns) is passed to Claude as context. You get summaries and CRM notes that reflect your actual deal progress.

---

## Pipeline tab

| Feature | How to use |
|---------|-----------|
| **Search** | Type account name, contact name, or keywords from notes |
| **Stage filter** | Click a stage chip to narrow the list |
| **Sort by value** | See biggest deals first |
| **Sort by due date** | Prioritize by urgency |

---

## Follow-up tracking

The **follow-up date** is the engine of the Today digest.

**Best practice:**
- Every active opportunity should always have a follow-up date
- After completing an action, immediately set the next follow-up date
- An empty follow-up date = "this deal is drifting"

**Urgency colors in Today digest:**
- Red dot = overdue (follow-up date is in the past)
- Amber dot = due today or within 3 days
- Gray dot = upcoming (more than 3 days out)

---

## Salesforce workflow

NexRev is designed to complement Salesforce, not replace it.

| In NexRev | In Salesforce |
|-----------|---------------|
| Daily notes & activity log | Official activity history |
| Kanban board (To Do / Follow-ups / Done) | Tasks & follow-up reminders |
| Meeting summaries | Manually copied from AI summary |
| Quick follow-up tracking | Opportunity stage & close date |

**Workflow:**
1. Log raw notes here (fast, no formatting required)
2. Use AI summarize to get a clean version
3. Use SF update note to get CRM-ready text (with Kanban context)
4. Copy-paste into Salesforce (30 seconds)

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

To run these commands against the Docker container:

```bash
docker compose exec backend node /app/scripts/manage-users.mjs list
```

The `JWT_SECRET` env var controls token signing. Set a strong random value in production:

```bash
JWT_SECRET=<64-char-random-string>
```

---

## Obsidian integration

The `.md` export is structured for Obsidian. Each opportunity exports with its stage, contact details, follow-up date, Kanban board state, and full activity log.

**Option A — Daily snapshot:** Export each day as `sales/2026-04-27.md`, browse with the Calendar plugin.

**Option B — Single living file:** Export and overwrite `sales/pipeline.md` each day; query with Dataview.

**Option C — Per-account notes:** After exporting, split each `###` section into its own note.

---

## Backup and restore

Data lives in `data/*.md` — human-readable Markdown files you can inspect, edit, or back up directly.

**JSON backup/restore:**
- Click **Backup** → downloads a JSON array of all opportunities
- Click **Import** → select a backup file, merges opportunities (existing IDs skipped)

**Moving to another machine:**
1. Copy the `data/` directory (contains `.md` files + `secrets.yaml`)
2. Set the same `JWT_SECRET` in the new `.env`
3. `docker compose up --build` on the new machine — data is immediately available

**Or:** export JSON on the old machine → import on the new machine.

---

## Troubleshooting

**Can't sign in / "Invalid credentials"**
→ Default login is `admin` / `admin` on first start
→ If you changed credentials and forgot them, use the manage-users.mjs CLI to reset the password

**Session expired / redirected to login unexpectedly**
→ JWT tokens expire after 24 hours — sign in again
→ Ensure `JWT_SECRET` in `.env` hasn't changed between restarts (changing it invalidates all tokens)

**AI buttons not working**
→ Ensure Ollama is running and the model is pulled: `ollama list`
→ Check `OLLAMA_BASE_URL` and `OLLAMA_MODEL` in `.env` and restart the backend
→ Look at backend logs: `docker compose logs backend`

**"Failed to connect to backend" error**
→ Run `docker compose up` and wait for all three services to start
→ Check `docker compose ps` — all services should show "running"

**Port already in use**
→ Stop the conflicting service or change the port in `docker-compose.yml`

**Data not persisting**
→ Ensure the `data/` volume mount is intact in `docker-compose.yml`
→ Run `ls data/` to confirm Markdown files are being written

**Development: frontend can't reach API**
→ Ensure the backend is running on port 3001 (`cd backend && npm run dev`)
→ The Vite proxy (`/api` → `localhost:3001`) only works when running `npm run dev` in the frontend
