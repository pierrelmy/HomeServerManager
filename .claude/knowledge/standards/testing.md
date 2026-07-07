# Testing Standards

## Test runners

- **Backend**: Vitest — `cd backend && npm test` (one-shot), `npm run test:watch` (watch)
- **Frontend**: Vitest + `@testing-library/react` — `cd frontend && npm test`
- **E2E**: Playwright — `cd frontend && npm run test:e2e` (requires `npx playwright install --with-deps chromium`)
- **Single file**: `cd backend && npx vitest run test/app.test.ts`

## Backend test patterns

Tests use `buildApp()` with injected fakes via `AppDependencies`. Never spin up a real SQLite database or real system adapter in tests.

```ts
const { app } = await buildApp(testConfig(), {
  repository: new FakeHomelabRepository(),
  sessions: new FakeSessionStore(),
  events: new EventHub(),
})
```

`testConfig()` sets `NODE_ENV=test`, `SYSTEM_ADAPTER=simulation`, disables logging.

### What every route test must cover

1. **Happy path** — 200/201 with correct response shape
2. **Auth guard** — 401 when no session, 403 when wrong role
3. **Input validation** — 400 on malformed body or params (Zod rejection)
4. **Audit trail** — mutating routes must produce an audit entry

### Rate limit tests

Sensitive routes (login, terminal) must be tested for rate limit rejection (429).

## Frontend test patterns

- Unit tests colocated with source (`live/homelabLiveManager.test.ts`)
- Use `@testing-library/react` — test behaviour, not implementation
- Tests must work in mock mode (no backend, no network)
- When testing a hook that uses context, wrap in the appropriate provider

## Mock parity rule

`MockHomelabRepository` and `MockHomelabRealtime` must remain behaviourally equivalent to their HTTP/WebSocket counterparts. When adding a new method or event type, update **both** implementations. Tests that only pass in one mode are a bug.

## Coverage priorities (in order)

1. Auth guards — every protected route rejects unauthenticated and unauthorised requests
2. Input validation — Zod schemas reject malformed payloads with 400
3. Audit trail — mutating actions write audit entries
4. WebSocket rate limiting — terminal command limits per session
5. Mock mode parity — frontend mock implementations match HTTP behaviour
6. Regression tests — every bug fix gets a test that would have caught it
