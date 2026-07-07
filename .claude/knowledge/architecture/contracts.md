# Contracts — Source of Truth

## What `backend/src/shared/contracts.ts` is

This file is the **single source of truth** for all types and Zod schemas shared between the backend and the frontend. It defines:

- Domain types (snapshot interfaces, records, enums)
- Zod schemas for HTTP request validation (body, params)
- `RealtimeEvent` union — every WebSocket event type the server can emit
- `RealtimeCommand` union — every WebSocket command the client can send
- `HomelabLiveBundle` — the full state snapshot shape

## How the frontend mirrors it

`frontend/src/domain/homelab.ts` re-exports or re-declares the types from `contracts.ts`. These two files must stay in sync. The frontend does **not** import from the backend package directly — types are maintained in both places.

When a type changes in `contracts.ts`, update `domain/homelab.ts` to match.

## How to evolve contracts

When adding a new domain concept (e.g. a new page, a new resource type):

1. **Define the type** in `contracts.ts` — this is the authoritative shape
2. **Add Zod schema** if there's HTTP input to validate (request body, params)
3. **Add RealtimeEvent type** if the backend will push updates for this concept (e.g. `{ type: "newresource.updated"; newResource: NewResource }`)
4. **Add RealtimeCommand type** if the client needs to request refreshes
5. **Update `HomelabLiveBundle`** to include the new field (as `NewResource | null`)
6. **Mirror in `domain/homelab.ts`** on the frontend
7. **Update `mockHomelabRealtime.ts`** to handle the new event in mock mode

## What lives here vs. elsewhere

| Lives in `contracts.ts` | Lives elsewhere |
|------------------------|-----------------|
| Shared domain types | Backend-only internals (e.g. `AuditEntry` detail, `StoredSession`) |
| HTTP request/response shapes | Frontend component props |
| WebSocket event/command unions | Frontend-only state (loading flags, UI state) |
| `HomelabLiveBundle` | Mock data (seed files) |

## Stability

`contracts.ts` is a public API surface shared by two packages. Changes here have wide blast radius:
- Backend routes that produce or consume these types
- Frontend pages that display them
- Frontend mock implementations that simulate them
- Tests that assert their shape

Always consider the full impact before modifying an existing type. Additive changes (new optional fields) are safe. Removing or renaming fields requires updating all consumers.
