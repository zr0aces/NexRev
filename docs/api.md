# API Reference

Base URL (Docker): `http://localhost:8088/api`  
Base URL (local dev): `http://localhost:3001/api`

All endpoints except `/auth/login` and `/health` require:

```
Authorization: Bearer <token>
```

---

## Authentication

### POST `/api/auth/login`

Authenticate and receive a JWT.

**Request**
```json
{ "username": "admin", "password": "admin" }
```

**Response `200`**
```json
{ "token": "<jwt>" }
```

**Response `401`**
```json
{ "error": "Invalid credentials" }
```

---

## Opportunities

### GET `/api/opportunities`

Return all opportunities as a JSON array.

---

### POST `/api/opportunities`

Create a new opportunity.

**Request body** — all fields optional except `name`:
```json
{
  "name": "Acme Corp",
  "contact": "Jane Smith",
  "contactEmail": "jane@acme.com",
  "contactMobile": "+1 555 000 0000",
  "contactTitle": "VP of Engineering",
  "value": 50000,
  "stage": "Proposal",
  "close": "2026-05-15",
  "followup": "2026-04-30",
  "nextStep": "Send revised proposal",
  "notes": "Free-form text"
}
```

**Response `201`** — the created opportunity object with generated `id`, `createdAt`, `updatedAt`.

---

### PUT `/api/opportunities/:id`

Replace all fields on an existing opportunity (partial update — omitted fields are cleared).

**Response `200`** — updated opportunity object.

---

### DELETE `/api/opportunities/:id`

Delete an opportunity and its `.md` file.

**Response `200`** `{ "ok": true }`

---

### POST `/api/import`

Bulk-import opportunities from a JSON backup array. Existing IDs are skipped.

**Request body** — JSON array of opportunity objects.

**Response `200`**
```json
{ "imported": 3, "skipped": 1 }
```

---

## Activities

### POST `/api/opportunities/:id/activities`

Add an activity log entry to an opportunity.

**Request**
```json
{
  "raw": "Raw meeting notes...",
  "summary": "Optional pre-formatted summary",
  "ai": false
}
```

**Response `200`** — updated opportunity object.

---

## Kanban steps

### POST `/api/opportunities/:id/steps`

Add a card to the Kanban board.

**Request**
```json
{ "text": "Send revised proposal", "column": "todo" }
```

`column` defaults to `"todo"` if omitted. Accepted values: `"todo"`, `"followup"`, `"done"`.

**Response `200`** — updated opportunity object.

---

### PATCH `/api/opportunities/:id/steps/:index`

Move a card to another column or toggle its done state.

**Request** — send one or both fields:
```json
{ "column": "done" }
{ "done": true }
{ "column": "followup", "done": false }
```

Column takes precedence — when `column` is set, `done` is derived automatically:
- `column: "done"` → `done = true`
- Any other column → `done = false`

When only `done` is sent:
- `done: true` → `column = "done"`
- `done: false` → `column = "todo"` (unless it was already `"followup"`)

**Response `200`** — updated opportunity object.

---

### DELETE `/api/opportunities/:id/steps/:index`

Remove a card by its zero-based index in `nextSteps`.

**Response `200`** — updated opportunity object.

---

## AI

Both endpoints require Ollama to be running and reachable. Returns `503` with a descriptive message otherwise.

### POST `/api/ai/summarize`

Summarize raw meeting notes, optionally with Kanban context.

**Request**
```json
{
  "raw": "Spoke with Jane. She wants revised numbers by Friday...",
  "kanban": {
    "todo": ["Send revised proposal"],
    "followup": ["Book follow-up call"],
    "done": ["Initial discovery call"]
  }
}
```

`kanban` is optional. When present, the board state is appended to the prompt.

**Response `200`**
```json
{ "summary": "Key points:\n- ..." }
```

---

### POST `/api/ai/sf-note`

Generate a Salesforce-ready CRM activity note.

**Request**
```json
{
  "oppName": "Acme Corp",
  "stage": "Proposal",
  "contact": "Jane Smith",
  "recentActivities": "2026-04-25: Reviewed pricing...",
  "nextStep": "Send revised proposal",
  "kanban": {
    "todo": ["Send revised proposal"],
    "followup": [],
    "done": ["Discovery call", "Demo"]
  }
}
```

**Response `200`**
```json
{ "note": "DATE: 2026-04-25\nACTIVITY TYPE: Meeting\n..." }
```

---

## Health

### GET `/health`

Returns `200 OK` — no auth required. Used by Docker health checks.
