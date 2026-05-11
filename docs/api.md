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
**Common errors**
- `400` missing username or password
- `401` invalid credentials
- `429` too many login attempts

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
**Common errors**
- `400` missing password or password too short
- `401` missing/invalid bearer token

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

## Passkeys / WebAuthn

Passkeys allow password-free authentication using the WebAuthn/FIDO2 standard. The backend must be configured with `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN`.

### POST `/api/auth/passkey/login-options`
Get challenge options for passkey login. Must be called before `/passkey/login`.
**Request**
```json
{ "username": "admin" }
```

### POST `/api/auth/passkey/login`
Verify a passkey authentication response and issue a JWT.
**Request**
```json
{ "username": "admin", "response": { ... } }
```
**Response `200`**
```json
{ "token": "<jwt>", "username": "admin" }
```
**Common errors**
- `400` missing username or response
- `401` passkey authentication failed

### POST `/api/auth/passkey/register-options` *(requires auth)*
Get challenge options for registering a new passkey.

### POST `/api/auth/passkey/register` *(requires auth)*
Verify and save a new passkey credential.
**Request**
```json
{ "response": { ... }, "name": "My MacBook" }
```

### GET `/api/auth/passkey/credentials` *(requires auth)*
List all registered passkeys for the current user.
**Response `200`**
```json
[{ "id": "...", "name": "My MacBook", "createdAt": "...", "lastUsedAt": "...", "deviceType": "multiDevice", "backedUp": true }]
```

### DELETE `/api/auth/passkey/credentials/:id` *(requires auth)*
Delete a specific passkey by its UUID.
**Response `200`**
```json
{ "ok": true }
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

AI endpoints use the configured provider (`AI_PROVIDER=ollama|openrouter|litellm`). Returns `503` if the configured provider is unavailable or misconfigured.

> **Rate limits**: Free/shared AI providers (e.g., OpenRouter `:free` models) may return `429 Too Many Requests`. The API surfaces this as a `429` with a human-readable error message rather than a generic 500.

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
**Common errors**
- `400` missing `id` or `raw`
- `404` opportunity not found
- `429` AI provider rate limit exceeded
- `503` AI provider unavailable or misconfigured

### POST `/api/ai/sf-note`
Generate a concise one-line Salesforce next-step note from activities since the last SF sync.
**Request**
```json
{ "id": "opp_id_here", "context": { "indices": [0, 1], "drafts": [] } }
```
`context` is optional. Omit to use all activities since the last SF note automatically.
**Response `200`**
```json
{ "note": "Met with procurement team — send revised proposal by Friday." }
```
**Common errors**
- `400` missing `id`
- `404` opportunity not found
- `422` no new activities since the last SF note
- `429` AI provider rate limit exceeded
- `503` AI provider unavailable or misconfigured

### POST `/api/ai/extract-tasks`
Extract Kanban tasks from recent activity logs and add them to the opportunity board.
**Request**
```json
{ "id": "opp_id_here", "context": { "indices": [0, 1] } }
```
`context` is optional.
**Response `200`** — Returns the updated opportunity object with new tasks added to `nextSteps`.
**Common errors**
- `400` missing `id`
- `404` opportunity not found
- `422` no new activities to extract tasks from
- `429` AI provider rate limit exceeded
- `503` AI provider unavailable or misconfigured

---

## Utility

### GET `/api/health`
Returns `200 OK`, the current application version, and whether the AI service is configured.
**Response `200`**
```json
{ "status": "ok", "version": "2026.5.17", "aiEnabled": true }
```
