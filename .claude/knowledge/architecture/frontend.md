# Frontend Architecture

## Two operating modes

| Mode | Condition | Data source |
|------|-----------|-------------|
| **Mock** | `VITE_API_BASE_URL` not set | `MockHomelabRepository` + `MockHomelabRealtime` |
| **Connected** | `VITE_API_BASE_URL` set | `HttpHomelabRepository` + `WebsocketHomelabRealtime` |

The factory functions in `createHomelabRepository.ts` and `createHomelabRealtimeTransport.ts` select the implementation. Mock mode must always remain functional — it's used for frontend-only development without a backend.

## Dual data layer

Two distinct concerns, two distinct layers:

### 1. `HomelabRepository` (`src/data/`) — REST mutations

```ts
interface HomelabRepository {
  getSession(): Promise<AuthSession>
  signIn(email, password): Promise<AuthSession>
  actOnService(id, action): Promise<ServiceRecord>
  runTool(id): Promise<ToolJob>
  // ... all CRUD operations
}
```

Used for: actions that change state (start/stop/restart, settings updates, password change). Consumed via `useHomelabRepository()` hook.

### 2. Live system (`src/live/`) — WebSocket reactive state

The `HomelabLiveManager` connects to `ws://.../live`, receives events, and merges them into a `HomelabLiveBundle` store. The bundle is a flat snapshot of all domain state:

```ts
interface HomelabLiveBundle {
  session: AuthSession | null
  overview: OverviewSnapshot | null
  services: ServiceRecord[] | null
  docker: DockerSnapshot | null
  nas: NasSnapshot | null
  tools: ToolsSnapshot | null
  terminal: TerminalSnapshot | null
  account: AccountProfile | null
  settings: SettingsState | null
}
```

On connect: server sends `bundle.synced` with the full current state.
On change: server sends granular events (`service.updated`, `terminal.line.appended`, etc.) — the manager merges these into the bundle without a full re-fetch.

Consumed via `useHomelabLive()` hook.

## React context providers

```
<HomelabRepositoryProvider>   // provides useHomelabRepository()
  <HomelabLiveProvider>       // provides useHomelabLive()
    <App />                   // Router, pages
  </HomelabLiveProvider>
</HomelabRepositoryProvider>
```

Both providers are set up in `main.tsx`.

## Pages

Each page in `src/pages/` follows the same pattern:
1. Read from live bundle: `const { docker, session } = useHomelabLive()`
2. Guard auth: redirect to `/login` if not authenticated
3. Fire mutations: `const repo = useHomelabRepository(); await repo.actOnContainer(id, "restart")`
4. Optimistic UI or wait for the WebSocket event to confirm the change

## Reconnection

`HomelabLiveManager` handles WebSocket disconnections with exponential backoff reconnection. On reconnect, the server re-sends the full `bundle.synced` — no client-side state patching needed.

## Domain types (`src/domain/homelab.ts`)

Frontend-side type aliases that mirror `backend/src/shared/contracts.ts`. When adding a new type to contracts.ts, add the corresponding export to `domain/homelab.ts`. These two files must stay in sync.
