# ADR-006: Cookie-based sessions, no JWT

## Status

Accepted

## Context

The backend needs to authenticate HTTP requests and WebSocket connections. Two common patterns:
- **JWT (stateless)**: server issues a signed token; no server-side state needed; revocation is hard
- **Cookie sessions (stateful)**: server maintains session store; revocation is instant; requires shared state if horizontally scaled

## Decision

Use signed HTTP cookies backed by a server-side `SessionStore` (in-memory + SQLite). Sessions can be revoked immediately (logout, forced expiry). The `@fastify/cookie` plugin handles cookie signing with the `SESSION_SECRET`.

No JWT, no OAuth providers (password-only authentication for now).

## Consequences

- Logout is reliable — the session is deleted server-side and the cookie is cleared
- WebSocket authentication reuses the same cookie — `getSession(request)` works identically for HTTP and WS upgrade requests
- Horizontal scaling would require a shared session store; for a single homelab host this is not a concern
- Adding a new auth provider (e.g. OAuth) would require extending `SessionStore` — the `provider` field on sessions is already typed as `AuthProvider = "google" | "github" | "password"` in contracts.ts as a forward-looking affordance
- Sessions expire after 24 hours (`maxAge: 24 * 60 * 60`)
