# Changelog

## Unreleased

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
