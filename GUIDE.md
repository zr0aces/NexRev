# Sales Dashboard — Daily Usage Guide

A practical, step-by-step guide to using the dashboard as your daily sales operating system.

---

## Setup

### First run

```bash
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env (needed for AI features)
docker compose up --build
```

Open **http://localhost**. The first time the backend starts it creates the `data/` directory automatically — no manual setup needed.

### Updating

```bash
docker compose down
git pull
docker compose up --build
```

Your data in `data/` is unaffected.

---

## Your daily routine (15–20 min)

### Morning: Plan your day

1. Open the dashboard → **Today** tab
2. Scan the digest — red = overdue, amber = due today or soon
3. For each item, click **View** to jump to the detail panel
4. Review the next steps checklist and update the follow-up date as needed
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
4. The summary is saved to the activity history automatically

> You don't need clean notes. Paste exactly what you have — messy, abbreviated, partial sentences are fine.

### After logging: Update Salesforce

1. After logging 1–3 recent activities, click **▪ SF update note**
2. Claude generates a Salesforce-ready activity note (date, type, summary, next step)
3. Copy and paste directly into Salesforce

### End of day: Export

1. Click **Export .md** in the nav — save to your Obsidian vault
2. Click **Backup JSON** weekly for a portable data backup

---

## Managing opportunities

### Add a new opportunity
- Click **+ Add Opportunity** or press `Cmd/Ctrl + K`
- Required: Account name
- Recommended: Stage, Contact, Follow-up date, Next step
- The follow-up date drives the Today digest — always set one

### Edit an opportunity
- In the Pipeline tab, click an account to open the detail panel
- Click **Edit** to modify stage, close date, follow-up, next step, or notes

### Delete an opportunity
- Open the detail panel → click **Delete** (cannot be undone)

### Next steps checklist
- Add specific, actionable steps (e.g. "Send revised proposal by Thu")
- Check items off as you complete them — they stay visible with strikethrough for context
- Remove stale items with the × button

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

The dashboard is designed to complement Salesforce, not replace it.

| In this dashboard | In Salesforce |
|------------------|---------------|
| Daily notes & activity log | Official activity history |
| Next steps checklist | Tasks & follow-up reminders |
| Meeting summaries | Manually copied from AI summary |
| Quick follow-up tracking | Opportunity stage & close date |

**Workflow:**
1. Log raw notes here (fast, no formatting required)
2. Use AI summarize to get a clean version
3. Use SF update note to get CRM-ready text
4. Copy-paste into Salesforce (30 seconds)

---

## Obsidian integration

The `.md` export is structured for Obsidian.

**Option A — Daily snapshot:** Export each day as `sales/2026-04-27.md`, browse with the Calendar plugin.

**Option B — Single living file:** Export and overwrite `sales/pipeline.md` each day; query with Dataview.

**Option C — Per-account notes:** After exporting, split each `###` section into its own note.

---

## Backup and restore

Data lives in `data/*.md` — these are human-readable Markdown files you can inspect, edit, or back up directly.

**JSON backup/restore:**
- Click **Backup JSON** → downloads a JSON array of all opportunities
- Click **Import JSON** → select a backup file, merges opportunities (existing IDs skipped)

**Moving to another machine:**
1. Export JSON on the old machine
2. Run the stack on the new machine
3. Click Import JSON and select the backup file

**Or:** copy the entire `data/` directory to the new machine — the files are self-contained.

---

## Troubleshooting

**AI buttons not working**
→ Check that `ANTHROPIC_API_KEY` is set in `.env` and the backend was restarted after editing it
→ Look at backend logs: `docker compose logs backend`

**"Failed to connect to backend" error**
→ Run `docker compose up` and wait for all three services to start
→ Check `docker compose ps` — all services should show "running"

**Port 80 already in use**
→ Stop the conflicting service or change the port in `docker-compose.yml`:
```yaml
ports:
  - "8080:80"
```

**Data not persisting**
→ Ensure the `data/` volume mount is intact in `docker-compose.yml`
→ Run `ls data/` to confirm Markdown files are being written

**Development: frontend can't reach API**
→ Ensure the backend is running on port 3001 (`cd backend && npm run dev`)
→ The Vite proxy (`/api` → `localhost:3001`) only works when running `npm run dev` in the frontend
