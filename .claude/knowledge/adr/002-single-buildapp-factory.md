# ADR-002: All routes in a single `buildApp()` factory

## Status

Accepted

## Context

Fastify supports organizing routes into plugins and separate route files. For a project of this size, splitting routes across files adds indirection without benefit.

## Decision

All routes, guards, plugin registrations, and lifecycle hooks live in a single `buildApp(config, dependencies?)` function in `src/app.ts`. The function returns the live instances (`app`, `repository`, `sessions`, `events`, `service`) for use in tests and the server entry point.

The `AppDependencies` optional parameter allows tests to inject fakes without module mocking:
```ts
export interface AppDependencies {
  repository?: HomelabRepository
  sessions?: SessionStore
  events?: EventHub
}
```

## Consequences

- `app.ts` is intentionally large — it is the single place to look for routing behaviour
- Tests call `buildApp()` directly with injected fakes; no mocking needed
- Adding a route always means editing `app.ts` — no risk of a route being defined somewhere obscure
- If the app grows significantly, routes could be extracted into Fastify plugins registered inside `buildApp()` — but this threshold has not been reached
