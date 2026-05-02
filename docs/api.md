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

### POST `/api/auth/password`
Update user password.
**Request**
```json
{ "password": "new-secure-password" }
```

### GET `/api/auth/telegram/link-token`
Generate a temporary token for Telegram account linking.

### GET `/api/auth/telegram/poll-link?token=<token>`
Poll for the `chat_id` associated with a link token. Returns `null` if not yet linked.

### POST `/api/auth/telegram`
Manually set or clear the Telegram `chatId`.
**Request**
```json
{ "chatId": "12345678" }
```

---

## Opportunities

Opportunity aggregate data is persisted in SQLite across `opportunities`, `next_steps`, and `activities`.

### GET `/api/opportunities`
Returns an array of all opportunity objects.

### POST `/api/opportunities`
Create a new opportunity.

### PUT `/api/opportunities/:id`
Update opportunity metadata.

### DELETE `/api/opportunities/:id`
Delete an opportunity and all related data.

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

### PATCH `/api/opportunities/:id/steps/:index`
Update a specific task (toggle `done`, change `column`, or edit `text`).

### DELETE `/api/opportunities/:id/steps/:index`
Remove a specific task.

---

## Bulk Operations

### POST `/api/import`
Bulk import opportunities from an array.

---

## AI Endpoints

### POST `/api/ai/summarize`
Summarize meeting notes.
**Request**
```json
{ "raw": "Meeting notes text...", "kanban": { "todo": [], "followup": [], "done": [] } }
```

### POST `/api/ai/sf-note`
Generate Salesforce CRM note.
**Request**
```json
{
  "oppName": "Acme",
  "stage": "Discovery",
  "contact": "John",
  "recentActivities": "Notes...",
  "nextStep": "Follow up",
  "kanban": { ... }
}
```

### POST `/api/ai/extract-tasks` **[NEW]**
Extract Kanban tasks from activity logs.
**Request**
```json
{ "activities": "Recent log text..." }
```
**Response `200`**
```json
{
  "todo": ["Task A", "Task B"],
  "followup": ["Follow up C"],
  "done": []
}
```

---

## Utility

### GET `/api/health`
Returns `200 OK` and the current application version. Used for Docker health checks and frontend version display.
**Response `200`**
```json
{ "status": "ok", "version": "2026.4.4" }
```
