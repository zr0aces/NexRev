# Configuration Guide

This document summarizes the environment variables used by NexRev and the production-specific checks enforced by the backend.

## Required in production

### Security / auth
- `JWT_SECRET`
  - Required in production.
  - Must not use the example placeholder value.
  - Must be at least 32 characters long.

### WebAuthn / passkeys
- `WEBAUTHN_RP_ID`
  - Must be your real domain in production.
  - `localhost` is only valid for development.
- `WEBAUTHN_ORIGIN`
  - Required in production.
  - Must use `https`.
  - Hostname must match `WEBAUTHN_RP_ID` or a subdomain of it.

### Browser/API access
- `CORS_ORIGIN`
  - Exact browser origin(s) allowed to call the API in production.
  - Use comma-separated values for multiple origins.

## Optional runtime configuration

### AI providers
- `AI_PROVIDER=ollama|openrouter|litellm`
- `AI_MODEL`
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL`
- `OPENROUTER_BASE_URL`, `OPENROUTER_MODEL`, `OPENROUTER_API_KEY`
- `LITELLM_BASE_URL`, `LITELLM_MODEL`, `LITELLM_MODEL_PREFIX`, `LITELLM_API_KEY`
- `OPENROUTER_OPENAI_FALLBACK=true|false`

### Notifications
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_NAME`
- `APP_URL`
- `REMINDER_TIMEZONE` (default: `Asia/Bangkok`)

### Logging / app
- `LOG_LEVEL`
- `PORT`
- `DATA_DIR`
- `NEXREV_VERSION`

## Docker Compose notes

- The compose samples pin nginx to `nginx:1.27-alpine`.
- Backend and frontend services expose health checks; nginx waits for both to become healthy.
- The backend now fails fast in production when critical auth or WebAuthn settings are unsafe.
