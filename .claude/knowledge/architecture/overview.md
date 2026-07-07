# Architecture Overview

## What it is

HomeServerManager is a homelab dashboard for supervising and administering a single self-hosted server. It provides real-time monitoring and controlled actions over Docker, systemd services, NAS, and custom tools.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, TypeScript, Tailwind CSS v4, React Router v7 |
| Backend | Fastify 5, TypeScript, Node.js 24 ESM |
| Persistence | SQLite via Node.js built-in `node:sqlite` (no ORM, no external package) |
| Real-time | WebSocket (`@fastify/websocket`) on `/live` |
| Reverse proxy | Caddy (TLS, routing, static file serving in production) |
| CI/CD | GitHub Actions (lint/test/build, CodeQL, GHCR image publish, manual deploy) |

## Monorepo layout

```
/
├── backend/          Fastify API
│   ├── src/
│   │   ├── app.ts               All routes + buildApp() factory
│   │   ├── config.ts            Env var parsing (Zod)
│   │   ├── shared/contracts.ts  Canonical types — source of truth
│   │   ├── services/            Business logic
│   │   ├── repositories/        SQLite persistence
│   │   ├── system/              Docker/systemd/NAS adapter
│   │   ├── auth/                Session store
│   │   └── events/              WebSocket EventHub
│   └── test/                    Vitest integration tests
├── frontend/         React SPA
│   └── src/
│       ├── domain/homelab.ts    Frontend-side domain types
│       ├── data/                HomelabRepository (REST layer)
│       ├── live/                WebSocket live system
│       ├── pages/               Route-level components
│       └── components/          Shared UI components
├── deploy/           Infrastructure (Caddy, Docker Compose, systemd, scripts)
├── docs/             Runbooks and project documentation
└── .claude/          Claude Code configuration (agents, knowledge)
```

## Request data flow (authenticated mutation)

```
Browser
  → POST /services/:id/restart   (cookie session)
    → app.ts: requireAdmin guard
    → app.ts: idParamsSchema.parse(params)
    → audited(repo, session, "service.restart", id, …)
      → HomelabService.actOnService(id, "restart")
        → SystemAdapter.restartService(unit)   ← real or simulated
        → repository.saveService(updated)
        → events.broadcast({ type: "service.updated", service: updated })
          → WebSocket /live → all connected clients
      → repository.appendAudit(…)
    → 200 ServiceRecord
```

## Real-time data flow (WebSocket `/live`)

```
Client connects to ws://.../live
  → Server: bundle.synced (full current state snapshot)
  → Server: connection.status "connected"

Server state changes (e.g. metrics refresh every 5s):
  → events.broadcast(granular event)
  → Client: HomelabLiveManager merges event into bundle
  → React re-renders affected pages via useHomelabLive()

Client sends command:
  → { type: "refresh.request", scope: "docker" }
  → Server: returns bundle.synced for that scope only
  OR
  → { type: "terminal.execute", command, sessionId }
  → Server: executes, appends result, broadcasts terminal.line.appended
```

## Production deployment model

```
Host OS (restricted user homeservermanager)
  └─ Backend process (systemd unit)
       ├─ SQLite database (host filesystem)
       └─ Real system calls (Docker CLI, systemctl, NAS commands)

Docker (on same host)
  ├─ Frontend container (Nginx, serves static build)
  └─ Caddy container (TLS termination, reverse proxy)
```
