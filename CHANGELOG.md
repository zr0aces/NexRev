# Changelog

## 2026.5.17

### Features
- Combined **AI Summarize** and **AI Extract Tasks** into a single streamlined **AI Summarize & Extract** button.
- AI task extraction now automatically leverages the generated summary for higher accuracy.
- Renamed "SF Update Note" button to **AI SF Suggest Note**.
- **AI SF Suggest Note** now generates a concise one-line next-step summary suitable for direct paste into Salesforce activity fields.
- **AI Summarize & Extract** is now disabled when the Log Activity textarea is empty, preventing accidental calls without context.
- Fully redesigned **Profile** and **Log** pages with modern layout, search, filtering, and responsive behavior.
- Added clickable account names in the Log tab to jump directly to opportunities in the Pipeline.

### Fixes
- Fixed 500 errors from AI endpoints when OpenRouter returned a 429 rate-limit response — the API now returns `429` with a human-readable message.
- Fixed `escapeHtml` in Telegram notifications over-escaping `"` and `'`, which could corrupt Telegram HTML entity parsing.
- Removed `(data as any)` cast in `App.tsx` — `aiEnabled` is now properly typed in the API client.

### Performance
- `opportunity-store.ts`: `patch()`, `upsertStep()`, and `removeStep()` no longer perform a redundant DB read after writing — saves one SQLite round-trip per Kanban and field-update operation.

### Code Quality
- Removed unused `ensureDataDir()` export from `storage.ts`.
- Cleaned up dual `fs`/`fsPromises` namespace imports in `server.ts` to named imports.
- Removed useless `try/catch` wrappers in `ai-service.ts` (`runCompletion`, `chat`) that silently re-threw without adding value.
- Removed stale `console.log` debug calls from `generateDailyDigest`.
- Simplified single-element `candidates[]` for-loop in `runCompletion` to a direct call.
- Removed unused `fileURLToPath` import from `server.ts`.

### Documentation
- Updated `docs/api.md`: corrected AI SF note example response format, added `429` error codes to all AI endpoints, added full Passkey/WebAuthn endpoint section.
- Updated `README.md`: corrected feature names to match UI (AI Extract Tasks, AI SF Suggest Note), added `429` to rate-limit security notes.

---

## 2026.5.16

### Security
- Enforced strong `JWT_SECRET` requirements in production and rejected placeholder secrets at startup.
- Added production WebAuthn configuration validation for `WEBAUTHN_RP_ID` and `WEBAUTHN_ORIGIN`.

### Reliability
- Hardened passkey transport parsing so malformed stored JSON no longer crashes registration or login flows.
- Improved Telegram notification handling with cache directory creation, cache cleanup, and reduced retries for non-retryable API failures.

### Operations
- Added `LOG_LEVEL`, `CORS_ORIGIN`, and `REMINDER_TIMEZONE` environment configuration guidance.
- Pinned nginx in Docker Compose samples and added service health checks.
- Improved `scripts/release.mjs` / `scripts/sync-version.mjs` verification and release output.
