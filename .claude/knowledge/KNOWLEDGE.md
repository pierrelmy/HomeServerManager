# Knowledge Base — HomeServerManager

Index of shared knowledge files for all agents. Read this file first, then follow the links relevant to your task.

## Standards

| File | Content |
|------|---------|
| [standards/coding.md](standards/coding.md) | TypeScript/ESM conventions, Zod, comments policy, abstraction rules |
| [standards/testing.md](standards/testing.md) | Vitest patterns, coverage priorities, mock parity |
| [standards/security.md](standards/security.md) | Guards, audit trail, CORS, cookies, rate limits, shell commands |

## Architecture

| File | Content |
|------|---------|
| [architecture/overview.md](architecture/overview.md) | High-level stack, data flow, monorepo layout |
| [architecture/backend.md](architecture/backend.md) | `buildApp()` factory, three-layer pattern, EventHub, SQLite |
| [architecture/frontend.md](architecture/frontend.md) | Dual data layer, mock mode, live bundle model |
| [architecture/contracts.md](architecture/contracts.md) | `contracts.ts` as source of truth, how to evolve it |

## Architecture Decision Records

| File | Decision |
|------|---------|
| [adr/001-monorepo-structure.md](adr/001-monorepo-structure.md) | Separate backend/frontend packages in a monorepo |
| [adr/002-single-buildapp-factory.md](adr/002-single-buildapp-factory.md) | All routes in one `app.ts`, no route files |
| [adr/003-dual-data-layer-frontend.md](adr/003-dual-data-layer-frontend.md) | REST for mutations, WebSocket for reactive state |
| [adr/004-simulation-adapter.md](adr/004-simulation-adapter.md) | `SimulationSystemAdapter` vs `LocalSystemAdapter` |
| [adr/005-node-sqlite-no-orm.md](adr/005-node-sqlite-no-orm.md) | Node.js built-in `node:sqlite`, no ORM |
| [adr/006-cookie-sessions.md](adr/006-cookie-sessions.md) | Cookie-based sessions, no JWT |

## Releases

| File | Content |
|------|---------|
| [releases/CHANGELOG.md](releases/CHANGELOG.md) | Release history and notable changes |
