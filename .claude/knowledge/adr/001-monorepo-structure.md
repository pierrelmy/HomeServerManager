# ADR-001: Monorepo with separate backend/frontend packages

## Status

Accepted

## Context

The project needs both a Fastify API and a React SPA. They share domain types but have completely different runtimes, build toolchains, and deployment targets.

## Decision

Use a single git repository with two independent npm packages (`backend/` and `frontend/`), coordinated by a root `package.json` with aggregate scripts (`npm run check`, `npm run build`, etc.).

No workspace hoisting (no `npm workspaces`) — each package manages its own `node_modules`. This keeps package resolution simple and avoids transitive dependency conflicts between Node.js and browser targets.

## Consequences

- `cd backend && npm ci` and `cd frontend && npm ci` must both be run for initial setup
- Types shared between packages are duplicated (maintained in both `contracts.ts` and `domain/homelab.ts`) rather than imported across packages
- Each package has its own TypeScript config, linter config, and test runner config
- Root scripts delegate to `npm --prefix backend` and `npm --prefix frontend`
