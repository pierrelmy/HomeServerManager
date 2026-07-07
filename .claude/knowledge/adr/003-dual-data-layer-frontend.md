# ADR-003: Dual data layer in the frontend (REST + WebSocket)

## Status

Accepted

## Context

The frontend needs both:
1. A way to perform actions (start a service, change a password, run a tool)
2. A way to receive live state updates without polling

Two approaches were considered:
- **REST only with polling**: simple but inefficient, introduces latency for live state
- **WebSocket only**: complex (re-implementing request/response semantics over WS, error handling, auth re-validation on each message)
- **REST for mutations + WebSocket for reactive state**: clean separation of concerns

## Decision

The frontend uses two distinct layers in parallel:

- `HomelabRepository` (REST over HTTP): handles all mutations and initial data fetching. Simple request/response, leverages HTTP semantics (status codes, cookies, rate limit headers).
- `HomelabLiveManager` (WebSocket `/live`): maintains a live bundle of all domain state. The server pushes the full bundle on connect, then granular events on change. The client merges events into its local bundle.

This means pages read from the live bundle (always up to date) and fire mutations through the repository (reliable, audited).

## Consequences

- State updates from mutations arrive via WebSocket, not as HTTP responses — components do not need to invalidate caches or re-fetch after an action
- The mock mode mirrors this dual layer: `MockHomelabRepository` + `MockHomelabRealtime`
- Adding a new write operation requires implementing it in both `httpHomelabRepository.ts` AND `mockHomelabRepository.ts`
- The WebSocket bundle can grow — care is needed to keep the initial `bundle.synced` payload bounded
