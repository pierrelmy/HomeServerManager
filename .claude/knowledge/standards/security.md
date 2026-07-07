# Security Standards

## Auth guard hierarchy

Three guards are defined in `app.ts`. Apply the most restrictive one that fits:

| Guard | Requirement | Use for |
|-------|-------------|---------|
| `readGuard` | session if `READ_AUTH_REQUIRED=true`, else public | Read-only GET routes |
| `requireSession` | any authenticated session | User-scoped actions (e.g. password change) |
| `requireAdmin` | session with `role === "admin"` | All write/action routes |

Every route must have an explicit guard. No route may be accidentally public for writes.

## Audit trail

Every mutating route must call `audited()` (async) or `audit()` (sync). Failures must also be recorded — `audited()` catches and re-throws while writing the failure entry.

```ts
return audited(repository, session, "service.restart", id, () => service.actOnService(id, "restart"))
```

Audit entries persist in SQLite and are accessible at `GET /audit` (admin only).

## CORS and origin checks

- CORS is configured via `@fastify/cors` with `isAllowedOrigin()` — only origins in `CORS_ORIGINS` env var are allowed in production
- Non-safe HTTP methods (POST, PATCH, DELETE) check the `Origin` header directly in an `onRequest` hook, independently of the CORS plugin
- WebSocket upgrades to `/live` check the origin before accepting the connection

## Cookies

Session cookie configuration:
- `httpOnly: true` — not accessible from JavaScript
- `sameSite: "strict"` — no cross-site sending
- `secure: true` in production — HTTPS only
- `signed: true` — tamper-evident via `@fastify/cookie` secret
- `maxAge: 24 * 60 * 60` — 24-hour expiry
- `SESSION_SECRET` must be ≥32 chars; production validation rejects the default value

## Shell command safety

User-controlled strings must **never** be interpolated into shell commands. All system commands are declared at startup via env vars and parsed into fixed arrays:
- `parseCommand(str, name)` → `string[]`
- `parseCommandMap(str, name)` → `Record<string, string[]>`
- `parseStringMap(str, name)` → `Record<string, string>`

The `TOOL_COMMANDS`, `SYSTEM_SERVICE_MAP`, `NAS_SCRUB_COMMAND`, and `NAS_STATUS_COMMAND` allowlists are resolved once at boot. Runtime code only picks from these pre-parsed arrays.

## Rate limits

Global: 100 req/min. Key per-route overrides:
- `POST /session`: 10/min (brute-force protection)
- Terminal WebSocket commands: 10 per session per 60s (fixed window, in-memory)
- NAS scrub: 2/hour
- Tool run: 5/min

## Security headers

Applied via `onSend` hook to every response:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Cache-Control: no-store`

## Production-only validations (`config.ts`)

The `loadConfig()` Zod schema enforces in production:
- `SESSION_SECRET` ≠ default value
- `ADMIN_PASSWORD` ≠ `"development-password"`
- `SYSTEM_ADAPTER === "local"`
- `READ_AUTH_REQUIRED === true`
- `CORS_ORIGINS` does not contain `localhost`
- `METRICS_TOKEN` ≠ default value
