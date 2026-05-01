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

---

## Opportunities

Opportunity aggregate data is persisted in SQLite across `opportunities`, `next_steps`, and `activities`.

### GET `/api/opportunities`
Returns an array of all opportunity objects.

### POST `/api/opportunities`
Create a new opportunity.
**Validation**: Duplicate account names are disallowed on the frontend, but the backend accepts them (one opportunity per client is enforced at the storage/ID level).

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
Returns `200 OK`. Used for Docker health checks.
