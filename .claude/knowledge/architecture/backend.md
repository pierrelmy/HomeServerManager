# Backend Architecture

## `buildApp()` factory (`src/app.ts`)

All routes, plugins, guards, and lifecycle hooks live in a single `buildApp(config, dependencies?)` function. It returns `{ app, repository, sessions, events, service }`.

The `AppDependencies` parameter lets tests inject fakes:
```ts
const { app } = await buildApp(testConfig(), {
  repository: new FakeRepository(),
  sessions: new FakeSessionStore(),
})
```

This pattern avoids module-level singletons and makes the entire app testable without mocking modules.

## Three-layer structure

```
HTTP Route (app.ts)
  → guard (readGuard / requireSession / requireAdmin)
  → Zod validation (request body / params)
  → HomelabService   ← business logic
      → HomelabRepository   ← read/write state
      → SystemAdapter       ← system I/O (Docker, systemd, NAS)
      → EventHub            ← push events to WebSocket clients
  → audited() writes audit entry
  → return response
```

### `HomelabRepository` (`src/repositories/homelab-repository.ts`)

Interface + `SqliteHomelabRepository` implementation. Owns all SQLite reads and writes. Methods are synchronous (Node.js `DatabaseSync`). Key responsibilities:
- Snapshot storage (overview, services, docker, nas, tools, terminal, account)
- Settings per user (`ownerId`)
- Audit log (`appendAudit`, `listAudit`)
- `ping()` for readiness check
- `close()` on app shutdown

Seeds in `seed.ts` provide initial/fallback data when the DB is empty.

### `HomelabService` (`src/services/homelab-service.ts`)

Stateless orchestration layer. Does not access SQLite directly — calls repository and system adapter. Also owns:
- `bundle(userId)` — assembles full snapshot for WebSocket initial push
- `configureLocalTargets(serviceMap, toolCommands)` — sets up allowlists from config
- `refreshSystemState()` — called every `METRICS_INTERVAL_MS` ms by the server

### `SystemAdapter` (`src/system/system-adapter.ts`)

Two implementations:
- `SimulationSystemAdapter` — returns plausible fake data, performs no I/O. Used in dev and CI (`SYSTEM_ADAPTER=simulation`).
- `LocalSystemAdapter` — calls real Docker CLI, systemctl, and NAS commands. Used in production only (`SYSTEM_ADAPTER=local`).

Commands are injected at construction time from env var allowlists — no runtime string building.

## EventHub (`src/events/event-hub.ts`)

Maintains the set of active WebSocket connections. API:
- `add(socket, sessionId?)` — registers a connection, returns a cleanup function
- `broadcast(event)` — sends to all connected sockets
- `sendToSession(sessionId, event)` — sends to a specific session's sockets
- `size` — current connection count (exposed via `/metrics`)

## Session store (`src/auth/session-store.ts`)

In-memory store backed by SQLite. Sessions are cookie-signed (via `@fastify/cookie`). On boot (`syncAdminOnBoot=true` in non-production), the admin account from env vars is upserted so dev credentials always work.

Roles: `admin` (full access) and `viewer` (read-only, not yet exposed in UI).

## Rate limiting

Registered globally via `@fastify/rate-limit`. Per-route overrides:

| Scope | Limit |
|---|---|
| Global | 100 req/min per IP |
| `POST /session` | 10 req/min |
| `POST /terminal/execute` | 10 cmd/min per session (fixed-window, in-process) |
| Admin action endpoints (start/stop/restart, scrub, etc.) | 5–20 req/min |

`cookie` and `authorization` headers are redacted from all pino log output — session tokens never appear in journal logs.

## Terminal routes

- `POST /terminal/execute` — runs a command in the active session (admin). Broadcast `terminal.line.appended` event via WebSocket.
- `POST /terminal/sessions/:id/clear` — clears session history (admin). Persisted to SQLite, broadcast `terminal.cleared` event.

## Audit route

`GET /audit` (admin) — returns chronological list of audit entries from SQLite. Every mutation that goes through `audited()` writes a `{action, resource, outcome, userId, timestamp}` record.

## Config (`src/config.ts`)

Parsed once at startup with Zod. Production mode enforces stricter constraints (see `standards/security.md`). All downstream code receives the typed `AppConfig` — never reads `process.env` directly.

Optional env vars with defaults: `LOG_LEVEL` (default `"info"`), `METRICS_INTERVAL_MS` (default `5000`).
