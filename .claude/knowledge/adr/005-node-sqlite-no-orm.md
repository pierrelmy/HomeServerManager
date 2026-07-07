# ADR-005: Node.js built-in `node:sqlite`, no ORM

## Status

Accepted

## Context

The backend needs persistence for snapshots, settings, sessions, and the audit trail. Options considered:
- External SQLite packages (`better-sqlite3`, `sql.js`)
- ORM (`Prisma`, `Drizzle`, `TypeORM`)
- Node.js 24 built-in `node:sqlite` (stable as of Node 24)
- External databases (PostgreSQL, etc.)

## Decision

Use the Node.js 24 built-in `node:sqlite` module (`DatabaseSync`) directly, with no ORM. SQL is written by hand inside `SqliteHomelabRepository`.

Rationale:
- Zero external dependencies for persistence — no version drift, no native addon compilation issues
- The data model is simple and stable; an ORM would add complexity without benefit
- `DatabaseSync` is synchronous, which matches Fastify's async handlers well (SQLite operations are fast enough to run synchronously without blocking the event loop at this scale)
- A single homelab deployment will never hit the scale limits of this approach

## Consequences

- Schema migrations are managed manually — when the schema changes, the migration must be written explicitly in `SqliteHomelabRepository`
- No query builder or type-safe schema — SQL strings must be maintained carefully
- All persistence logic lives in `SqliteHomelabRepository`; tests inject a different implementation
- Node.js 24 is the minimum version (enforced in root `package.json` `engines` field)
