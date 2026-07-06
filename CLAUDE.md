# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# From root — lint + test + build (CI gate)
npm run check

# Backend
cd backend && npm run typecheck   # type-check only (faster feedback)
cd backend && npm run lint
cd backend && npm test            # vitest run (all tests, one-shot)
cd backend && npm run test:watch  # vitest in watch mode
cd backend && npm run dev         # tsx watch src/server.ts

# Frontend
cd frontend && npm run lint
cd frontend && npm test           # vitest run
cd frontend && npm run dev        # Vite dev server
cd frontend && npm run test:e2e   # Playwright (requires chromium via `npx playwright install --with-deps chromium`)
```

Running a single backend test file:
```bash
cd backend && npx vitest run test/app.test.ts
```

## Architecture

### Monorepo layout

- `backend/` — Fastify 5 API, SQLite persistence, WebSocket `/live`
- `frontend/` — React 19 + Vite SPA
- `deploy/` — Caddy, systemd, Docker Compose, GitHub Actions
- `docs/` — operations runbook

### Backend

All routes live in a single `src/app.ts` `buildApp()` factory. There are no separate route files — the factory wires plugins, guards, and routes, then returns `{ app, repository, sessions, events, service }`. Tests inject test doubles via the optional `AppDependencies` parameter.

Three-layer structure:
- **`HomelabRepository`** (`src/repositories/homelab-repository.ts`) — interface + SQLite implementation. All reads/writes go through this. Tests can inject in-memory fakes.
- **`HomelabService`** (`src/services/homelab-service.ts`) — orchestrates between the repository, the system adapter, and the event hub. Owns business logic.
- **`SystemAdapter`** — two implementations: `SimulationSystemAdapter` (no side effects, used in dev/test) and `LocalSystemAdapter` (real Docker/systemd/NAS calls, used in production). Controlled by `SYSTEM_ADAPTER` env var.

**EventHub** (`src/events/event-hub.ts`) manages live WebSocket connections. On connect, the server pushes a full `bundle.synced` event with the current state, then fires granular events (e.g. `service.updated`) as state changes.

**Session store** (`src/auth/session-store.ts`) is in-memory + SQLite-backed, cookie-signed. Two roles: `admin` (full write access) and `viewer` (read-only). The `READ_AUTH_REQUIRED` flag controls whether even reads require authentication.

**Shared contracts** (`src/shared/contracts.ts`) is the canonical type and Zod schema source — both the backend routes and the frontend domain types derive from it.

### Frontend

Two data layers run in parallel:

1. **`HomelabRepository`** (`src/data/homelabRepository.ts`) — interface for REST calls (CRUD). Two implementations: `HttpHomelabRepository` (real API) and `MockHomelabRepository` (static data, no backend needed). Selected by `createHomelabRepository.ts` based on whether `VITE_API_BASE_URL` is set.

2. **Live system** (`src/live/`) — WebSocket transport. `HomelabLiveManager` handles connection, reconnection, and merges incoming events into a `HomelabLiveBundle` store. The `HomelabLiveProvider` makes the bundle available via context. Two transport implementations: `WebsocketHomelabRealtime` and `MockHomelabRealtime`.

When `VITE_API_BASE_URL` / `VITE_WS_URL` are not set, the frontend runs fully in **mock mode** — no backend required.

Pages under `src/pages/` consume the live bundle via `useHomelabLive()` and fire mutations through `useHomelabRepository()`.

### Dev environment

Backend dev requires several env vars (see README.md "Option 1"). The key ones:

| Var | Dev value |
|-----|-----------|
| `SYSTEM_ADAPTER` | `simulation` — no real Docker/systemd calls |
| `DATABASE_PATH` | `./data/homelab.dev.db` |
| `READ_AUTH_REQUIRED` | `false` |
| `NODE_ENV` | `development` |
