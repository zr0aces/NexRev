# API Reference

## Authentication

Authentication and profile metadata are persisted in SQLite `users`.

### POST `/api/auth/login`
**Request**
```json
{ "username": "admin", "password": "admin" }
```
**Response `200`**
```json
{ "token": "<jwt>", "username": "admin" }
```

### GET `/api/auth/me`
Returns current user profile and Telegram link status.
**Response `200`**
```json
{ "username": "admin", "telegram_chat_id": "12345678" }
```

### GET `/api/auth/users`
Returns all registered users (used for multi-user filtering).
**Response `200`**
```json
[{ "username": "admin" }]
```

### POST `/api/auth/password`
Update user password (minimum 8 characters).
**Request**
```json
{ "password": "new-secure-password" }
```

### POST `/api/auth/telegram`
Manually set or clear the Telegram `chatId` for the current user.
**Request**
```json
{ "chatId": "12345678" }
```
Pass `null` to unlink.

### GET `/api/auth/telegram/link-token`
Generate a temporary one-time token for Telegram account linking (expires in 5 minutes).
**Response `200`**
```json
{ "token": "<hex>", "botName": "MyNexRevBot" }
```

### GET `/api/auth/telegram/poll-link?token=<token>`
Poll for the `chatId` associated with a link token. Returns `null` if not yet linked.
**Response `200`**
```json
{ "chatId": "12345678" }
```

---

## Opportunities

Opportunity aggregate data is persisted in SQLite across `opportunities`, `next_steps`, and `activities`.

### GET `/api/opportunities`
Returns an array of all opportunity objects.

### POST `/api/opportunities`
Create a new opportunity. `name` is required.
**Request body fields:** `name`, `contact`, `contactEmail`, `contactMobile`, `contactTitle`, `value`, `stage`, `close`, `followup`, `nextStep`, `notes`.

### PUT `/api/opportunities/:id`
Update opportunity metadata (partial update supported).

### DELETE `/api/opportunities/:id`
Delete an opportunity and all related data (cascades to steps and activities).

---

## Sub-resources

### POST `/api/opportunities/:id/activities`
Add an activity log entry.
**Request**
```json
{ "raw": "Meeting notes...", "summary": "Short summary", "ai": true, "sf": false }
```

### POST `/api/opportunities/:id/steps`
Add a new Kanban task (step).
**Request**
```json
{ "text": "Follow up with procurement", "column": "todo" }
```

### PATCH `/api/opportunities/:id/steps/:index`
Update a specific task by its zero-based index.
**Request** (all fields optional)
```json
{ "done": true, "column": "done", "text": "Updated text" }
```

### DELETE `/api/opportunities/:id/steps/:index`
Remove a specific task by its zero-based index.

---

## Bulk Operations

### POST `/api/import`
Bulk import opportunities from an array (max 500 items). Existing IDs are skipped.
**Request**
```json
[{ "name": "Acme Corp", "stage": "Prospecting", ... }]
```
**Response `200`**
```json
{ "imported": 3, "skipped": 1 }
```

---

## AI Endpoints

All AI endpoints require Ollama to be running. Returns `503` if Ollama is unreachable.

### POST `/api/ai/summarize`
Summarize raw meeting notes for a specific opportunity.
**Request**
```json
{ "id": "opp_id_here", "raw": "Meeting notes text..." }
```
**Response `200`**
```json
{ "summary": "Concise summary of the meeting notes." }
```

### POST `/api/ai/sf-note`
Generate a Salesforce CRM-ready activity note from recent activities since the last SF sync.
**Request**
```json
{ "id": "opp_id_here", "context": { "indices": [0, 1], "drafts": [] } }
```
`context` is optional. Omit to use all activities since the last SF note.
**Response `200`**
```json
{ "note": "DATE: ...\nACTIVITY TYPE: ...\nSUMMARY: ...\nNEXT STEP: ..." }
```

### POST `/api/ai/extract-tasks`
Extract Kanban tasks from recent activity logs and add them to the opportunity board.
**Request**
```json
{ "id": "opp_id_here", "context": { "indices": [0, 1] } }
```
`context` is optional.
**Response `200`** — Returns the updated opportunity object with new tasks added to `nextSteps`.

---

## Utility

### GET `/api/health`
Returns `200 OK`, the current application version, and whether the AI service is configured.
**Response `200`**
```json
{ "status": "ok", "version": "2026.5.13", "aiEnabled": true }
```
